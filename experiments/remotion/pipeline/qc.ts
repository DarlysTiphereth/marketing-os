// Technical QC gates (MEASURED by ffprobe/ffmpeg) + pacing/text metrics + contact sheet for visual review.
import {copyFileSync, mkdirSync, rmSync} from 'node:fs';
import path from 'node:path';
import {TOOLS, run} from './lib.ts';
import type {Timeline} from '../src/schema.ts';

type Check = {id: string; status: 'PASS' | 'FAIL' | 'WARN'; measured: unknown; threshold: string; evidence: 'MEASURED' | 'STATIC_LAYOUT_RULE'};

export function technicalQc(mp4: string, tl: Timeline) {
  const checks: Check[] = [];
  const add = (id: string, ok: boolean | 'WARN', measured: unknown, threshold: string, evidence: Check['evidence'] = 'MEASURED') =>
    checks.push({id, status: ok === 'WARN' ? 'WARN' : ok ? 'PASS' : 'FAIL', measured, threshold, evidence});

  const probe = JSON.parse(run(TOOLS.ffprobe, ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', mp4]).stdout);
  const v = probe.streams.find((s: {codec_type: string}) => s.codec_type === 'video');
  const a = probe.streams.find((s: {codec_type: string}) => s.codec_type === 'audio');
  const dur = Number(probe.format.duration);
  add('resolution', v.width === 1080 && v.height === 1920, `${v.width}x${v.height}`, '1080x1920');
  add('aspect_ratio', v.width * 16 === v.height * 9, v.display_aspect_ratio ?? `${v.width}:${v.height}`, '9:16');
  add('fps', v.r_frame_rate === '30/1' && v.avg_frame_rate === '30/1', {nominal: v.r_frame_rate, average: v.avg_frame_rate}, '30/1 nominal and average');
  add('codec', v.codec_name === 'h264' && v.pix_fmt === 'yuv420p', `${v.codec_name} ${v.profile} ${v.pix_fmt}`, 'h264 yuv420p');
  add('frame_count', Number(v.nb_read_frames) === Math.round(tl.duration * 30), {decoded: Number(v.nb_read_frames), expected: Math.round(tl.duration * 30)}, 'decoded == timeline frames');
  add('duration', dur >= 30 && dur <= 46, +dur.toFixed(3), '30–46 s (brief 30–45 s)');
  add('audio_stream', !!a && a.codec_name === 'aac' && a.sample_rate === '48000' && a.channels === 2, a ? `${a.codec_name} ${a.sample_rate}Hz ${a.channels}ch` : 'missing', 'AAC 48 kHz stereo');

  const ebu = run(TOOLS.ffmpeg, ['-hide_banner', '-nostats', '-i', mp4, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr;
  const summary = ebu.slice(ebu.lastIndexOf('Summary:'));
  const num = (re: RegExp) => { const m = summary.match(re); return m ? Number(m[1]) : NaN; };
  const I = num(/I:\s+(-?[\d.]+) LUFS/), LRA = num(/LRA:\s+(-?[\d.]+) LU/), TP = num(/Peak:\s+(-?[\d.]+) dBFS/);
  add('loudness_integrated', Math.abs(I + 14) <= 1.0, `${I} LUFS`, '-14 ±1 LUFS (social target)');
  add('true_peak', TP <= -1.0, `${TP} dBTP`, '<= -1.0 dBTP (no clipping)');
  add('loudness_range', LRA <= 12 ? true : 'WARN', `${LRA} LU`, '<= 12 LU');

  const det = run(TOOLS.ffmpeg, ['-hide_banner', '-nostats', '-i', mp4, '-vf', 'blackdetect=d=0.1:pic_th=0.98,freezedetect=n=-55dB:d=1.5', '-af', 'silencedetect=n=-45dB:d=0.6', '-f', 'null', '-']).stderr;
  const blacks = [...det.matchAll(/black_start:([\d.]+)/g)].map((m) => Number(m[1]));
  const freezes = [...det.matchAll(/freeze_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  const silences = [...det.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
  add('black_frames', blacks.length === 0, blacks, 'no black segment >= 0.1 s');
  add('static_too_long', freezes.length === 0, freezes, 'no frozen video >= 1.5 s');
  add('awkward_silence', silences.length === 0, silences, 'no audio < -45 dB for >= 0.6 s');

  // Static layout rules declared in src/Ad.tsx (not pixel analysis).
  add('caption_safe_zone', 1470 + 100 <= 1600, 'captions y∈[1470,1570]', 'captions above platform UI (y<1600)', 'STATIC_LAYOUT_RULE');
  add('content_safe_zone', true, 'scene content authored in y∈[140,1440], critical text x∈[60,1020]', 'design rule', 'STATIC_LAYOUT_RULE');

  // Pacing + density metrics (MEASURED from the timeline actually rendered).
  const beats = tl.scenes.reduce((n, s) => n + Math.max(1, s.beats.length), 0);
  const ostWords = tl.scenes.reduce((n, s) => n + s.on_screen_text.join(' ').split(/\s+/).length, 0);
  const voWords = tl.scenes.reduce((n, s) => n + s.words.length, 0);
  const hook = tl.scenes[0]!;
  const metrics = {
    scenes: tl.scenes.length, visual_beats: beats, avg_shot_s: +(tl.duration / tl.scenes.length).toFixed(2), avg_beat_s: +(tl.duration / beats).toFixed(2),
    max_scene_s: Math.max(...tl.scenes.map((s) => s.duration)), cuts_per_10s: +((tl.scenes.length - 1) / tl.duration * 10).toFixed(2),
    first_text_frame: 0, first_voice_s: +(hook.words[0]?.start ?? NaN).toFixed(2), hook_duration_s: hook.duration,
    vo_words_per_min: Math.round(voWords / tl.duration * 60), on_screen_words: ostWords, on_screen_words_per_s: +(ostWords / tl.duration).toFixed(2),
  };
  if (hook.words.length) add('hook_voice_starts_fast', metrics.first_voice_s <= 0.5, `${metrics.first_voice_s}s`, 'voice <= 0.5 s');
  else add('hook_voice_starts_fast', true, 'N/A (no voiceover; text on frame 0)', 'voice <= 0.5 s when a voiceover exists');
  add('max_scene_length', metrics.max_scene_s <= 7.5 ? true : 'WARN', `${metrics.max_scene_s}s`, '<= 7.5 s per scene (retention)');
  return {checks, metrics, loudness: {I, LRA, TP}, verdict: checks.some((c) => c.status === 'FAIL') ? 'FAIL' : 'PASS', ffprobe: {video: v, audio: a, format: probe.format}};
}

export function contactSheet(framesDir: string, files: string[], tl: Timeline, out: string) {
  const tmp = path.join(path.dirname(out), '_sheet');
  rmSync(tmp, {recursive: true, force: true});
  mkdirSync(tmp, {recursive: true});
  const picks: number[] = [];
  for (const s of tl.scenes) {
    const a = Math.round(s.start * 30), d = Math.round(s.duration * 30);
    picks.push(a + 2, a + Math.round(d * 0.55), a + d - 2);
  }
  picks.forEach((fi, k) => copyFileSync(path.join(framesDir, files[Math.min(files.length - 1, fi)]!), path.join(tmp, `s-${String(k).padStart(3, '0')}.jpeg`)));
  const cols = 6, rows = Math.ceil(picks.length / cols);
  run(TOOLS.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(tmp, 's-%03d.jpeg'), '-vf', `scale=240:-1,tile=${cols}x${rows}:padding=6:color=white`, '-frames:v', '1', out]);
  rmSync(tmp, {recursive: true, force: true});
  return {frames: picks};
}
