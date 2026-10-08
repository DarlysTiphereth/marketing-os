// Voice stage: local OneCore TTS (offline, $0) with content-addressed cache + word timings.
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {ROOT, TOOLS, readJson, readWav, run, sha256, writeJson} from './lib.ts';

const CACHE = path.join(ROOT, '.cache', 'tts');
const VO_CHAIN = 'highpass=f=85,acompressor=threshold=-21dB:ratio=3:attack=4:release=90:makeup=2.5dB,equalizer=f=3200:t=q:w=1.4:g=2.5,equalizer=f=220:t=q:w=1.0:g=1.5,aresample=48000';
const CHAIN_VERSION = 'vo-chain-1';

export type VoiceLine = {
  wav48: string; cache_key: string; cached: boolean; seconds: number;
  speech_start: number; speech_end: number; words: {text: string; start: number}[];
  voice: string; provider: string; source_rate_hz: number;
};

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function synthesize(text: string, voiceName: string, ratePct: number, provider = 'windows-onecore-local'): VoiceLine {
  // 'none' = silent line (fixtures / platforms without a TTS engine). Timing then comes from min_duration_s.
  if (provider === 'none' || !text.trim()) return {wav48: '', cache_key: 'none', cached: true, seconds: 0, speech_start: 0, speech_end: 0, words: [], voice: 'none', provider: 'none', source_rate_hz: 0};
  if (process.platform !== 'win32') throw new Error(`voice provider ${provider} needs Windows OneCore; use voice 'none' or pre-rendered lines on this worker`);
  mkdirSync(CACHE, {recursive: true});
  const key = sha256(['onecore', voiceName, ratePct, text, CHAIN_VERSION].join('|')).slice(0, 20);
  const base = path.join(CACHE, key);
  const meta = `${base}.json`, raw = `${base}.raw.wav`, wav48 = `${base}.48k.wav`, info = `${base}.line.json`;
  if (existsSync(info) && existsSync(wav48)) return {...readJson<VoiceLine>(info), cached: true};

  // "…" becomes a real pause; rate applied with SSML prosody.
  const body = xml(text).replace(/…/g, '<break time="260ms"/>');
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="pt-BR"><prosody rate="${ratePct >= 0 ? '+' : ''}${ratePct}%">${body}</prosody></speak>`;
  writeFileSync(`${base}.ssml`, ssml, 'utf8');
  run(TOOLS.powershell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'pipeline/tts/onecore-tts.ps1'),
    '-Voice', voiceName, '-Ssml', `${base}.ssml`, '-OutWav', raw, '-OutJson', meta]);
  run(TOOLS.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', raw, '-af', VO_CHAIN, '-ac', '1', '-c:a', 'pcm_s16le', wav48]);

  const pcm = readWav(wav48);
  const d = pcm.data[0]!, n = d.length, win = Math.round(pcm.rate * 0.01);
  // Speech bounds: first/last 10ms window above -42 dBFS RMS.
  const rmsAt = (i: number) => { let s = 0; for (let j = i; j < Math.min(n, i + win); j++) s += d[j]! * d[j]!; return Math.sqrt(s / win); };
  const thr = Math.pow(10, -42 / 20);
  let a = 0; while (a < n && rmsAt(a) < thr) a += win;
  let b = n - win; while (b > a && rmsAt(b) < thr) b -= win;
  const m = readJson<{voice: string; words: {text: string; start_ms: number}[] | {text: string; start_ms: number}}>(meta);
  const words = (Array.isArray(m.words) ? m.words : [m.words]).map((w) => ({text: w.text, start: w.start_ms / 1000}));
  const line: VoiceLine = {
    wav48, cache_key: key, cached: false, seconds: n / pcm.rate, speech_start: a / pcm.rate, speech_end: Math.min(n, b + win) / pcm.rate,
    words, voice: m.voice, provider: 'windows-onecore-local', source_rate_hz: readWav(raw).rate,
  };
  writeJson(info, line);
  return line;
}
