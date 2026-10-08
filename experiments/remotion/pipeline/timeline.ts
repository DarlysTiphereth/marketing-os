// Timeline: scene durations are driven by measured voiceover length (never by guesswork),
// on-screen text beats are aligned to the spoken word that introduces them.
import type {SceneT, Timeline, TimedScene, VisualStyleT, VariantSelection} from '../src/schema.ts';
import {normWord} from './lib.ts';
import type {VoiceLine} from './voice.ts';

const DIGITS: Record<string, string> = {'5': 'cinco', l: 'litros'};

function beatsFor(scene: SceneT, words: {text: string; start: number}[], sceneDur: number): number[] {
  const vw = words.map((w) => normWord(w.text));
  const beats: number[] = [];
  let cursor = 0;
  scene.on_screen_text.forEach((ost, i) => {
    if (i === 0 && scene.slot === 'hook') { beats.push(0); return; } // hook text must be on frame 0
    const tokens = ost.split(/\s+/).map((t) => normWord(t)).map((t) => DIGITS[t] ?? t).filter((t) => t.length >= 3);
    let hit = -1;
    for (let k = cursor; k < vw.length && hit < 0; k++) if (tokens.includes(vw[k]!)) hit = k;
    if (hit >= 0) { beats.push(Math.max(0, words[hit]!.start - 0.06)); cursor = hit + 1; }
    else beats.push((sceneDur * (i + 0.5)) / scene.on_screen_text.length); // fallback: evenly spaced
  });
  for (let i = 1; i < beats.length; i++) beats[i] = Math.max(beats[i]!, beats[i - 1]! + 0.2);
  return beats;
}

export function buildTimeline(args: {
  variant_id: string; creative_id: string; selection: VariantSelection; style: VisualStyleT;
  scenes: SceneT[]; lines: VoiceLine[]; fps: number; assets: Record<string, string>; display: Timeline['display'];
}): Timeline & {scenes: (TimedScene & {beats: number[]})[]} {
  const {fps} = args;
  const pace = args.selection.pacing === 'fast' ? 0.88 : 1;
  const snap = (s: number) => Math.round(s * fps) / fps;
  let t = 0;
  const scenes = args.scenes.map((s, i) => {
    const line = args.lines[i]!;
    const lead = s.slot === 'hook' ? 0.05 : 0.12;
    const tail = s.slot === 'cta' ? 1.0 : 0.22 * pace;
    const speech = line.speech_end - line.speech_start;
    const duration = snap(Math.max(s.min_duration_s * pace, lead + speech + tail));
    const vo_start = t + lead - line.speech_start;
    const rel = line.words.map((w) => ({text: w.text, start: w.start + lead - line.speech_start}));
    const words = rel.map((w, k) => ({text: w.text, start: t + w.start, end: t + (k + 1 < rel.length ? rel[k + 1]!.start : line.speech_end + lead - line.speech_start)}));
    const timed = {...s, start: snap(t), duration, vo_start, vo_duration: line.seconds, words, beats: beatsFor(s, rel, duration)};
    t = snap(t + duration);
    return timed;
  });
  return {variant_id: args.variant_id, creative_id: args.creative_id, selection: args.selection, style: args.style,
    fps, width: 1080, height: 1920, duration: t, scenes, assets: args.assets, display: args.display};
}
