// Cinematic cut from licensed stock footage: FFmpeg edit + grade, Remotion transparent overlay (type + real packshot),
// procedural score, composite, technical QC, manifest.   node pipeline/cinematic.ts [--edl cinematic/edit.json]
import {openBrowser, renderFrames, selectComposition} from '@remotion/renderer';
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {REPO, ROOT, RunLog, TOOLS, gitInfo, prng, run, sha256, sha256File, timed, writeJson, writeWav16} from './lib.ts';
import {browserOptions, getBundle} from './render.ts';
import {normalize} from './audio.ts';
import {technicalQc} from './qc.ts';
import {ensureLayout, managed} from '../../../ops/config.ts';
import {Cas} from '../../../ops/storage/cas.ts';
import type {Timeline} from '../src/schema.ts';
import type {OverlayProps, OverlayShot} from '../src/Cinematic.tsx';

type Shot = {id: string; src: string; in: number; dur: number; grade: string; crop?: {w: number; h: number; x: number; y: number}; push?: number; transition_in: string;
  text?: {label: string; line: string; at: number}; hero?: boolean; claim_refs?: string[]; sfx?: string[]};
type Edl = {edit_id: string; format: {width: number; height: number; fps: number}; sources: Record<string, {local: string; sha256: string; page: string; license: string}>; shots: Shot[]; audio: {seed: number; bpm: number}};

const {values: a} = parseArgs({options: {edl: {type: 'string', default: 'cinematic/edit.json'}}});
const t0 = performance.now();
const edlPath = path.resolve(ROOT, a.edl!);
const edlRaw = readFileSync(edlPath);
const edl = JSON.parse(edlRaw.toString('utf8')) as Edl;
ensureLayout();
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}_${sha256(edlRaw).slice(0, 10)}`;
const runDir = path.join(ROOT, 'cinematic', 'runs', runId);
mkdirSync(runDir, {recursive: true});
const work = managed('tmp', `cinematic-${runId}`);
mkdirSync(work, {recursive: true});
const log = new RunLog(path.join(runDir, 'run.log'));
const fps = edl.format.fps;

try {
  // 1. Source integrity (licensed stock, verified by hash).
  for (const [k, s] of Object.entries(edl.sources)) {
    const p = path.resolve(REPO, s.local);
    if (!existsSync(p) || sha256File(p) !== s.sha256) throw new Error(`source ${k} missing or changed`);
  }
  log.log('sources', `${Object.keys(edl.sources).length} stock sources verified`);

  // 2. Timing: dissolves overlap the previous shot; cuts butt-join.
  let t = 0;
  const timed_shots = edl.shots.map((s, i) => {
    const tr = s.transition_in ?? 'cut';
    const d = tr.startsWith('dissolve:') ? Number(tr.split(':')[1]) : 0;
    const start = i === 0 ? 0 : t - d;
    t = start + s.dur;
    return {...s, start, dissolve: d};
  });
  const duration = Math.round(t * fps) / fps;

  // 3. Base edit in FFmpeg (fast input seek, crop, smooth push-in, grade, vignette).
  const inputs: string[] = [], chains: string[] = [];
  timed_shots.forEach((s, i) => {
    inputs.push('-ss', String(s.in), '-t', String(s.dur + 0.1), '-i', path.resolve(REPO, edl.sources[s.src]!.local));
    const crop = s.crop ? `crop=${s.crop.w}:${s.crop.h}:${s.crop.x}:${s.crop.y},` : '';
    const push = s.push ?? 0;
    // Scale slightly above 1080×1920 by an amount that grows with t, then center-crop: a smooth digital dolly-in.
    // Exact 1080×1920 first (even-size rounding of -2 gave 1918 px and broke the crop), then grow both axes with t.
    const k = `(1+${push}*if(isnan(t),0,t)/${s.dur})`;
    const fit = 'scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920';
    const scale = push ? `${fit},scale=w='trunc(1080*${k}/2)*2':h='trunc(1920*${k}/2)*2':eval=frame:flags=lanczos,crop=1080:1920` : fit;
    chains.push(`[${i}:v]fps=${fps},${crop}${scale},${s.grade},vignette=PI/5.5,setsar=1,format=yuv420p,trim=duration=${s.dur},setpts=PTS-STARTPTS[v${i}]`);
  });
  let last = 'v0', joined: string[] = [];
  const graph = [...chains];
  timed_shots.forEach((s, i) => {
    if (i === 0) return;
    if (s.dissolve) {
      const off = timed_shots[i - 1]!.dur - s.dissolve + (i > 1 ? 0 : 0);
      graph.push(`[${last}][v${i}]xfade=transition=fade:duration=${s.dissolve}:offset=${off}[x${i}]`);
      last = `x${i}`;
    } else { joined.push(last); last = `v${i}`; }
  });
  joined.push(last);
  graph.push(`${joined.map((j) => `[${j}]`).join('')}concat=n=${joined.length}:v=1:a=0[base]`);
  const base = path.join(work, 'base.mp4');
  const [, baseTime] = await timed(() => run(TOOLS.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', graph.join(';'), '-map', '[base]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '12', '-pix_fmt', 'yuv420p', '-r', String(fps), base]));
  log.log('edit', `base edit ${duration}s`, {seconds: baseTime});

  // 4. Overlay (transparent PNG frames) — product and logo from the shared product database.
  const product = JSON.parse(readFileSync(path.join(REPO, 'factories/shared/products/grand/sabao-liquido-premium-5l.json'), 'utf8'));
  const cas = new Cas();
  const publicDir = path.join(work, 'public');
  const files: Record<string, string> = {};
  for (const key of ['packshot', 'logo']) {
    const asset = product.assets[key];
    const p = path.resolve(REPO, asset.local_path_hint);
    if (sha256File(p) !== asset.sha256) throw new Error(`asset ${key} hash mismatch`);
    const ref = cas.put(p, {name: `grand/${key}`, class: 'cache', run_id: runId});
    cas.materialize(ref.sha256, path.join(publicDir, `${key}.png`));
    files[key] = `${key}.png`;
  }
  const props: OverlayProps = {duration, files: {product: files.packshot!, logo: files.logo!},
    shots: timed_shots.map((s): OverlayShot => ({id: s.id, start: s.start, dur: s.dur, ...(s.text ? {text: s.text} : {}), ...(s.hero ? {hero: true} : {})})),
    display: {brand: 'GRAND', tagline: 'Limpeza & Proteção', product: 'Sabão Líquido Premium', variant: '5 L'}, cta: timed_shots.find((s) => s.hero)?.text?.line ?? ''};
  const srcFp = sha256(readdirSync(path.join(ROOT, 'src')).filter((f) => /\.tsx?$/.test(f)).sort().map((f) => sha256File(path.join(ROOT, 'src', f))).join('|')).slice(0, 16);
  const serveUrl = await getBundle({publicDir, outDir: managed('cache', 'bundles', `${srcFp}-cinematic`)});
  const framesDir = path.join(work, 'overlay');
  mkdirSync(framesDir, {recursive: true});
  const browser = await openBrowser('chrome', browserOptions());
  const [, overlayTime] = await timed(async () => {
    try {
      const inputProps = props as unknown as Record<string, unknown>;
      const composition = await selectComposition({serveUrl, id: 'CinematicOverlay', inputProps, puppeteerInstance: browser, ...browserOptions()});
      await renderFrames({composition, serveUrl, inputProps, outputDir: framesDir, imageFormat: 'png', puppeteerInstance: browser, concurrency: 3, ...browserOptions(),
        onStart: () => {}, onFrameUpdate: () => {}});
    } finally { await browser.close({silent: true}); }
  });
  const overlayFiles = readdirSync(framesDir).filter((f) => f.endsWith('.png')).sort();
  log.log('overlay', `${overlayFiles.length} transparent frames`, {seconds: overlayTime});

  // 5. Score: slow pad progression, soft pulse in the middle act, foley-like SFX at cuts, bloom on the hero.
  const [mix, audioTime] = await timed(() => score(timed_shots, duration, edl.audio, work));
  log.log('audio', 'score rendered', {seconds: audioTime, loudnorm_input_i: mix.measured.input_i});

  // 6. Composite + encode (bit-exact).
  const out = path.join(runDir, 'final.mp4');
  const digits = overlayFiles[0]!.replace(/^element-/, '').replace(/\.png$/, '').length;
  const [, encTime] = await timed(() => run(TOOLS.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', base, '-framerate', String(fps), '-i', path.join(framesDir, `element-%0${digits}d.png`), '-i', mix.final,
    '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto,format=yuv420p[v]', '-map', '[v]', '-map', '2:a',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-r', String(fps), '-g', String(fps * 2), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart',
    '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:v', '+bitexact', '-flags:a', '+bitexact', out]));
  log.log('encode', 'final.mp4', {seconds: encTime});

  // 7. QC (same technical gates; duration window from this brief: 20–30 s).
  const pseudo = {duration, fps, scenes: timed_shots.map((s) => ({...s, words: [], beats: [0], on_screen_text: s.text ? [s.text.line] : [], duration: s.dur}))} as unknown as Timeline;
  const qc = technicalQc(out, pseudo, {minDur: 20, maxDur: 30});
  const sheet = path.join(runDir, 'contact-sheet.jpg');
  const times = timed_shots.flatMap((s) => [s.start + 0.25, s.start + s.dur * 0.6]);
  run(TOOLS.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', out, '-vf', `select='${times.map((x) => `between(t,${x.toFixed(2)},${(x + 0.034).toFixed(2)})`).join('+')}',scale=270:-2,tile=7x2:padding=6:color=white`, '-frames:v', '1', '-fps_mode', 'vfr', sheet]);
  log.log('qc', `technical ${qc.verdict}`, {failed: qc.checks.filter((c) => c.status !== 'PASS').map((c) => c.id)});
  const stored = cas.put(out, {name: `${edl.edit_id}.mp4`, class: 'candidate', run_id: runId});

  const total = (performance.now() - t0) / 1000;
  writeJson(path.join(runDir, 'qc.json'), {technical: qc.checks, verdict: qc.verdict, loudness: qc.loudness, metrics: qc.metrics, visual: 'PENDING_REVIEW'});
  writeJson(path.join(runDir, 'manifest.json'), {run_id: runId, edit_id: edl.edit_id, edl: path.relative(REPO, edlPath).replaceAll('\\', '/'), edl_sha256: sha256(edlRaw),
    status: qc.verdict === 'PASS' ? 'RENDERED_TECH_PASS' : 'RENDERED_TECH_FAIL', git: gitInfo(), output: {file: 'final.mp4', sha256: stored.sha256, bytes: statSync(out).size, duration_s: duration},
    sources: Object.fromEntries(Object.entries(edl.sources).map(([k, s]) => [k, {page: s.page, sha256: s.sha256, license: s.license}])),
    shots: timed_shots.map((s) => ({id: s.id, src: s.src, in: s.in, dur: s.dur, start: +s.start.toFixed(3), claim_refs: s.claim_refs ?? []})),
    product_treatment: 'real packshot pixels composited (shadow, reflection, light sweep); not generated',
    voiceover: 'none', cost: {api_usd: 0, stock_usd: 0}, timings_s: {base_edit: +baseTime.toFixed(1), overlay: +overlayTime.toFixed(1), audio: +audioTime.toFixed(1), encode: +encTime.toFixed(1), total: +total.toFixed(1)},
    review: 'PENDING_HUMAN_REVIEW'});
  log.log('done', runDir, {seconds: total});
} catch (e) {
  log.log('error', String((e as Error).stack ?? e));
  process.exitCode = 1;
} finally {
  rmSync(work, {recursive: true, force: true});
  setTimeout(() => process.exit(process.exitCode ?? 0), 2000).unref();
}

// ---------- procedural score ----------
function score(shots: (Shot & {start: number})[], duration: number, cfg: {seed: number; bpm: number}, dir: string) {
  const SR = 48000, N = Math.ceil(duration * SR), L = new Float32Array(N), R = new Float32Array(N);
  const r = prng(cfg.seed), TAU = Math.PI * 2, beat = 60 / cfg.bpm;
  const add = (at: number, buf: Float32Array, g: number, pan = 0) => { const i0 = Math.round(at * SR), gl = g * Math.cos((pan + 1) * Math.PI / 4), gr = g * Math.sin((pan + 1) * Math.PI / 4);
    for (let i = 0; i < buf.length; i++) { const k = i0 + i; if (k < 0 || k >= N) continue; L[k]! += buf[i]! * gl; R[k]! += buf[i]! * gr; } };
  const synth = (sec: number, fn: (t: number) => number) => { const o = new Float32Array(Math.ceil(sec * SR)); for (let i = 0; i < o.length; i++) o[i] = fn(i / SR); return o; };
  const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
  const hero = shots.find((s) => s.hero)!;
  // Pads: Dm9 – Bbmaj7 – Fmaj7 – C(add9), two bars each, soft attack, detuned partials; final bloom on the hero.
  const chords = [[50, 57, 60, 64, 65], [46, 53, 57, 60, 62], [41, 53, 57, 60, 64], [48, 55, 59, 62, 64]];
  const bar = beat * 4;
  for (let b = 0, t = 0; t < duration; b++, t += bar * 2) {
    const ch = chords[b % 4]!, len = Math.min(bar * 2 + 0.6, duration - t + 0.5);
    ch.forEach((m, k) => add(t, synth(len, (x) => { const f = mtof(m); let s = 0; for (let h = 1; h <= 4; h++) s += Math.sin(TAU * f * h * x * (1 + (k - 2) * 0.0012)) / (h * h); return s * Math.min(1, x / 0.9) * Math.min(1, (len - x) / 0.8); }), 0.05, (k - 2) * 0.3));
  }
  // Soft pulse (kick + shaker) only in the "gestures" act, building toward the hero.
  const actStart = shots[2]!.start, actEnd = hero.start;
  for (let t = actStart; t < actEnd; t += beat) {
    let ph = 0;
    add(t, synth(0.4, (x) => { ph += TAU * (44 + 60 * Math.exp(-x * 25)) / SR; return Math.sin(ph) * Math.exp(-x * 7); }), 0.42);
    for (const o of [beat / 2]) { let p1 = 0; add(t + o, synth(0.06, (x) => { const n = r() * 2 - 1, h = n - p1; p1 = n; return h * Math.exp(-x * 60); }), 0.05, 0.3); }
  }
  const noise = (sec: number) => synth(sec, () => r() * 2 - 1);
  const lp = (x: Float32Array, cut: (t: number) => number) => { const y = new Float32Array(x.length); let s = 0; for (let i = 0; i < x.length; i++) { const al = 1 - Math.exp(-TAU * cut(i / SR) / SR); s += al * (x[i]! - s); y[i] = s; } return y; };
  const lib: Record<string, Float32Array> = {
    drop: (() => { let ph = 0; return synth(0.5, (x) => { ph += TAU * (1200 * Math.exp(-x * 18) + 260) / SR; return Math.sin(ph) * Math.exp(-x * 11) * 0.9; }); })(),
    whoosh: lp(noise(0.55), (x) => 250 + 4800 * Math.sin(Math.PI * x / 0.55) ** 2).map((v, i) => v * Math.sin(Math.PI * (i / SR) / 0.55) ** 1.6 * 2.4),
    splash: lp(noise(0.7), (x) => 2500 * Math.exp(-x * 4) + 300).map((v, i) => v * Math.exp(-(i / SR) * 6) * 1.8),
    riser: (() => { const n = lp(noise(2.2), (x) => 300 + 6000 * (x / 2.2) ** 2); return n.map((v, i) => v * ((i / SR) / 2.2) ** 2.4 * 1.6); })(),
    impact: (() => { let ph = 0; return synth(2.2, (x) => { ph += TAU * (34 + 60 * Math.exp(-x * 14)) / SR; return Math.sin(ph) * Math.exp(-x * 2.2); }); })(),
    shine: synth(1.8, (x) => [1567.98, 2093, 2637, 3136].reduce((s, f, k) => { const tt = x - k * 0.07; return tt < 0 ? s : s + Math.sin(TAU * f * tt) * Math.exp(-tt * 3.2) * 0.14; }, 0)),
  };
  for (const s of shots) for (const name of s.sfx ?? []) {
    const at = name === 'riser' ? s.start + s.dur - 2.2 : name === 'whoosh' ? s.start - 0.22 : name === 'shine' ? s.start + 1.0 : s.start + (name === 'drop' ? 0.15 : 0);
    add(Math.max(0, at), lib[name]!, ({drop: 0.5, whoosh: 0.32, splash: 0.35, riser: 0.28, impact: 0.7, shine: 0.5} as Record<string, number>)[name] ?? 0.3, name === 'whoosh' ? -0.25 : 0);
  }
  const fo = Math.round(1.2 * SR);
  for (let i = N - fo; i < N; i++) { const g = (N - i) / fo; L[i]! *= g; R[i]! *= g; }
  const premix = path.join(dir, 'premix.wav');
  writeWav16(premix, {rate: SR, channels: 2, data: [L, R]});
  const final = path.join(dir, 'mix.wav');
  const n = normalize(premix, final);
  return {final, measured: n.measured};
}
