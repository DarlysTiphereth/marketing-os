// Audio stage: procedural (seeded) music bed + SFX library + VO placement + ducking + 2-pass loudnorm.
// No external tracks/samples: licensing-clean and deterministic. Quality ceiling is a known limitation.
import path from 'node:path';
import {TOOLS, prng, readWav, run, writeWav16} from './lib.ts';
import type {Timeline} from '../src/schema.ts';
import type {VoiceLine} from './voice.ts';

const SR = 48000;
const TAU = Math.PI * 2;
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

type Stereo = [Float32Array, Float32Array];
const stereo = (sec: number): Stereo => [new Float32Array(Math.ceil(sec * SR)), new Float32Array(Math.ceil(sec * SR))];

function place(dst: Stereo, at: number, src: Float32Array, gain: number, pan = 0) {
  const i0 = Math.round(at * SR), gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < src.length; i++) {
    const k = i0 + i; if (k < 0 || k >= dst[0].length) continue;
    dst[0][k]! += src[i]! * gl; dst[1][k]! += src[i]! * gr;
  }
}

function synth(sec: number, fn: (t: number, i: number) => number) {
  const out = new Float32Array(Math.ceil(sec * SR));
  for (let i = 0; i < out.length; i++) out[i] = fn(i / SR, i);
  return out;
}

// ---------- SFX library ----------
function sfxLib(seed: number) {
  const r = prng(seed);
  const noise = (sec: number) => synth(sec, () => r() * 2 - 1);
  const lowpass = (x: Float32Array, cutoff: (t: number) => number) => {
    const y = new Float32Array(x.length); let s = 0;
    for (let i = 0; i < x.length; i++) { const a = 1 - Math.exp(-TAU * cutoff(i / SR) / SR); s += a * (x[i]! - s); y[i] = s; }
    return y;
  };
  const impact = (() => {
    let ph = 0; const n = noise(0.9); const nl = lowpass(n, () => 900);
    return synth(0.9, (t, i) => { ph += TAU * (38 + 70 * Math.exp(-t * 18)) / SR; return Math.sin(ph) * Math.exp(-t * 4.2) * 0.95 + nl[i]! * Math.exp(-t * 30) * 1.6; });
  })();
  const whoosh = (() => { const n = noise(0.45); const f = lowpass(n, (t) => 300 + 5200 * Math.sin(Math.PI * t / 0.45) ** 2); return f.map((v, i) => v * Math.sin(Math.PI * (i / SR) / 0.45) ** 1.5 * 2.6); })();
  const pop = (() => { let ph = 0; return synth(0.11, (t) => { ph += TAU * (520 + 520 * Math.min(1, t / 0.05)) / SR; return Math.sin(ph) * Math.exp(-t * 38) * 0.8; }); })();
  const stamp = (() => { let ph = 0; const n = lowpass(noise(0.25), () => 2500); return synth(0.25, (t, i) => { ph += TAU * (70 + 90 * Math.exp(-t * 40)) / SR; return Math.sin(ph) * Math.exp(-t * 16) + n[i]! * Math.exp(-t * 60) * 1.4; }); })();
  const shine = synth(1.1, (t) => [2093, 2637, 3136, 4186].reduce((s, f, k) => { const tt = t - k * 0.045; return tt < 0 ? s : s + Math.sin(TAU * f * tt) * Math.exp(-tt * 5.5) * 0.18; }, 0));
  const wave = (() => { const n = noise(1.2); const f = lowpass(n, (t) => 400 + 1400 * Math.sin(Math.PI * t / 1.2)); return f.map((v, i) => v * Math.sin(Math.PI * (i / SR) / 1.2) * 2.2); })();
  const riser = (sec: number) => { const n = noise(sec); const f = lowpass(n, (t) => 300 + 7000 * (t / sec) ** 2); let ph = 0;
    return f.map((v, i) => { const t = i / SR, p = t / sec; ph += TAU * (180 + 900 * p * p) / SR; return (v * 1.8 + Math.sin(ph) * 0.25) * p ** 2.2; }); };
  return {impact, whoosh, pop, stamp, shine, wave, riser: riser(1.6), riser_short: riser(0.8)};
}

// ---------- Music ----------
function music(tl: Timeline, bpm: number, seed: number): Stereo {
  const r = prng(seed);
  const total = tl.duration;
  const out = stereo(total);
  const beat = 60 / bpm;
  const prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
  const slotAt = (t: number) => tl.scenes.find((s) => t >= s.start && t < s.start + s.duration)?.slot ?? 'cta';
  const cta = tl.scenes.find((s) => s.slot === 'cta');
  const drumsEnd = cta ? cta.start + beat * 1 : total;
  const kickTimes: number[] = [];
  const nb = Math.ceil(total / beat);
  for (let b = 0; b < nb; b++) {
    const t = b * beat; if (t >= drumsEnd) break;
    const slot = slotAt(t), bar = Math.floor(b / 4), chord = prog[bar % 4]!;
    // kick
    kickTimes.push(t);
    let ph = 0;
    place(out, t, synth(0.34, (x) => { ph += TAU * (46 + 80 * Math.exp(-x * 30)) / SR; return Math.sin(ph) * Math.exp(-x * 8.5); }), 0.75);
    // clap on 2 & 4
    if (b % 4 === 1 || b % 4 === 3) {
      let prev = 0;
      place(out, t, synth(0.2, (x) => { const n = r() * 2 - 1, hp = n - prev; prev = n; const env = [0, 0.009, 0.018].reduce((s, o) => s + (x >= o ? Math.exp(-(x - o) * (o === 0.018 ? 22 : 90)) : 0), 0); return hp * env * 0.5; }), 0.32, 0.05);
    }
    // hats: 8ths, 16ths in tension
    const sub = slot === 'tension' ? 4 : 2;
    for (let k = 0; k < sub; k++) {
      let p1 = 0, p2 = 0;
      const accent = k % 2 === 1 ? 1 : 0.6;
      place(out, t + (k * beat) / sub, synth(0.05, (x) => { const n = r() * 2 - 1, h1 = n - p1; p1 = n; const h2 = h1 - p2; p2 = h1; return h2 * Math.exp(-x * 70); }), 0.075 * accent, k % 2 ? 0.35 : -0.35);
    }
    // bass: 8th-note offbeat pump on chord root
    if (slot !== 'hook' || b > 0) for (let k = 0; k < 2; k++) {
      const f = mtof(chord[0]! - 24); let p = 0;
      place(out, t + k * beat / 2, synth(beat / 2 * 0.92, (x) => { p += TAU * f / SR; let s = 0; for (let h = 1; h <= 6; h++) s += Math.sin(h * p) / h; return s * Math.min(1, x / 0.004) * Math.exp(-x * 5); }), 0.2);
    }
    // arp (bright sections)
    if (['demo', 'benefits', 'payoff'].includes(slot)) for (let k = 0; k < 4; k++) {
      const note = chord[(b * 4 + k) % 3]! + (slot === 'payoff' ? 24 : 12); const f = mtof(note);
      place(out, t + k * beat / 4, synth(0.22, (x) => { const tri = 2 / Math.PI * Math.asin(Math.sin(TAU * f * x)); return tri * Math.exp(-x * 14); }), 0.07, k % 2 ? 0.3 : -0.3);
    }
  }
  // pad: chord per bar, whole duration (rings through CTA), soft
  const nbars = Math.ceil(total / (beat * 4));
  for (let bar = 0; bar < nbars; bar++) {
    const t0 = bar * beat * 4, len = beat * 4 + 0.4, chord = prog[bar % 4]!;
    chord.forEach((m, k) => {
      const f = mtof(m), d = 1 + (k - 1) * 0.0015;
      place(out, t0, synth(len, (x) => (Math.sin(TAU * f * x) + 0.5 * Math.sin(TAU * f * 2 * d * x)) * Math.min(1, x / 0.25) * Math.min(1, (len - x) / 0.35)), 0.035, (k - 1) * 0.4);
    });
  }
  // sidechain pump from kicks
  for (let i = 0; i < out[0].length; i++) {
    const t = i / SR; let last = -1; for (let k = kickTimes.length - 1; k >= 0; k--) if (kickTimes[k]! <= t) { last = kickTimes[k]!; break; }
    const g = last < 0 ? 1 : 1 - 0.35 * Math.exp(-(t - last) * 9);
    out[0][i]! *= g; out[1][i]! *= g;
  }
  // fade out last 0.5s
  const fo = Math.round(0.5 * SR), n = out[0].length;
  for (let i = n - fo; i < n; i++) { const g = (n - i) / fo; out[0][i]! *= g; out[1][i]! *= g; }
  return out;
}

export function buildAudio(tl: Timeline, lines: VoiceLine[], opts: {bpm: number; seed: number; workDir: string}) {
  const total = tl.duration;
  const vo = stereo(total);
  tl.scenes.forEach((s, i) => { if (!lines[i]!.wav48) return; const pcm = readWav(lines[i]!.wav48); place(vo, s.vo_start, pcm.data[0]!, 1.0, 0); });

  const sfx = stereo(total);
  const lib = sfxLib(opts.seed + 7);
  const cues: {name: string; at: number}[] = [];
  tl.scenes.forEach((s) => {
    let bi = 0;
    for (const name of s.sfx) {
      let at = s.start;
      if (name === 'whoosh') at = s.start - 0.18;
      else if (name.startsWith('riser')) at = s.start + s.duration - (name === 'riser' ? 1.6 : 0.8);
      else if (name !== 'impact') at = s.start + (s.beats[bi++] ?? 0);
      const buf = (lib as Record<string, Float32Array>)[name];
      if (!buf) continue;
      const gain = ({impact: 0.55, whoosh: 0.35, pop: 0.3, stamp: 0.5, shine: 0.45, wave: 0.28, riser: 0.22, riser_short: 0.2} as Record<string, number>)[name] ?? 0.3;
      place(sfx, Math.max(0, at), buf, gain, name === 'whoosh' ? -0.2 : 0);
      cues.push({name, at: +at.toFixed(3)});
    }
  });

  const mus = music(tl, opts.bpm, opts.seed);
  // Ducking: music follows VO envelope (attack 10ms / release 220ms), up to -7 dB under speech.
  let env = 0; const att = Math.exp(-1 / (0.01 * SR)), rel = Math.exp(-1 / (0.22 * SR));
  const mix = stereo(total);
  for (let i = 0; i < mix[0].length; i++) {
    const v = Math.abs(vo[0][i]!) + Math.abs(vo[1][i]!);
    env = v > env ? att * env + (1 - att) * v : rel * env + (1 - rel) * v;
    const duck = 1 - 0.55 * Math.min(1, env / 0.12);
    for (const c of [0, 1] as const) mix[c][i] = vo[c][i]! * 1.0 + mus[c][i]! * 0.42 * duck + sfx[c][i]! * 0.8;
  }
  const premix = path.join(opts.workDir, 'premix.wav');
  writeWav16(premix, {rate: SR, channels: 2, data: [mix[0], mix[1]]});
  const final = path.join(opts.workDir, 'mix.wav');
  const n = normalize(premix, final);
  return {final, premix, cues, loudnorm_pass1: n.measured, target: n.target};
}

// Two-pass EBU R128 loudnorm to the social target, then a brickwall limiter (AAC overshoot headroom).
export function normalize(premix: string, final: string) {
  // Two-pass EBU R128 loudnorm to social target (-14 LUFS, TP -1.5).
  const target = {I: -14, TP: -2.0, LRA: 11}; // -2.0: AAC re-encode overshoots ~1 dB on dense music-only mixes (measured)
  const p1 = run(TOOLS.ffmpeg, ['-hide_banner', '-nostats', '-i', premix, '-af', `loudnorm=I=${target.I}:TP=${target.TP}:LRA=${target.LRA}:print_format=json`, '-f', 'null', '-']);
  const m = JSON.parse(p1.stderr.slice(p1.stderr.lastIndexOf('{'), p1.stderr.lastIndexOf('}') + 1));
  run(TOOLS.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', premix, '-af',
    `loudnorm=I=${target.I}:TP=${target.TP}:LRA=${target.LRA}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,alimiter=limit=0.7:attack=2:release=60:level=false,aresample=48000`,
    '-c:a', 'pcm_s16le', final]);
  return {measured: m, target};
}
