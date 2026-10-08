import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync, appendFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.resolve(ROOT, '../..');

// Tools are resolved from env first, then from the media-stack-lab portable installs observed in the audit.
export const TOOLS = {
  ffmpeg: process.env.MOS_FFMPEG ?? (process.platform === 'win32' ? 'C:/Projects/media-stack-lab/.tools/ffmpeg/9.0.2/ffmpeg.exe' : 'ffmpeg'),
  ffprobe: process.env.MOS_FFPROBE ?? (process.platform === 'win32' ? 'C:/Projects/media-stack-lab/.tools/ffmpeg/9.0.2/ffprobe.exe' : 'ffprobe'),
  // On Linux workers leave MOS_CHROME unset: Remotion downloads its pinned headless shell.
  chrome: process.env.MOS_CHROME ?? (process.platform === 'win32' ? 'C:/Projects/media-stack-lab/experiments/remotion/node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe' : ''),
  powershell: 'powershell.exe',
};

export const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex');
export const sha256File = (p: string) => sha256(readFileSync(p));
export const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;
export const writeJson = (p: string, v: unknown) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n');

export function run(cmd: string, args: string[], opts: {cwd?: string; allowFail?: boolean} = {}) {
  const r = spawnSync(cmd, args, {cwd: opts.cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 256 * 1024 * 1024});
  if (r.status !== 0 && !opts.allowFail) throw new Error(`${path.basename(cmd)} failed (${r.status}): ${(r.stderr || '').slice(-2000)}`);
  return {status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? ''};
}

export function gitInfo() {
  const g = (a: string[]) => run('git', ['-C', REPO, ...a], {allowFail: true}).stdout.trim();
  return {commit: g(['rev-parse', 'HEAD']) || 'UNKNOWN', dirty: g(['status', '--porcelain']).length > 0};
}

export class RunLog {
  private file: string;
  constructor(file: string) { this.file = file; }
  log(stage: string, msg: string, extra?: Record<string, unknown>) {
    const line = JSON.stringify({t: new Date().toISOString(), stage, msg, ...extra});
    appendFileSync(this.file, line + '\n');
    console.log(`[${stage}] ${msg}`);
  }
}

export async function timed<T>(fn: () => Promise<T> | T): Promise<[T, number]> {
  const t0 = performance.now();
  const v = await fn();
  return [v, (performance.now() - t0) / 1000];
}

// ---- WAV (PCM16 / float32) ----
export type Pcm = {rate: number; channels: number; data: Float32Array[]};

export function readWav(file: string): Pcm {
  const b = readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`not a WAV: ${file}`);
  let off = 12, fmt = {format: 0, channels: 0, rate: 0, bits: 0}, dataOff = -1, dataLen = 0;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4), len = b.readUInt32LE(off + 4);
    if (id === 'fmt ') fmt = {format: b.readUInt16LE(off + 8), channels: b.readUInt16LE(off + 10), rate: b.readUInt32LE(off + 12), bits: b.readUInt16LE(off + 22)};
    if (id === 'data') { dataOff = off + 8; dataLen = Math.min(len, b.length - off - 8); break; }
    off += 8 + len + (len % 2);
  }
  if (dataOff < 0) throw new Error(`no data chunk: ${file}`);
  const bytes = fmt.bits / 8, frames = Math.floor(dataLen / (bytes * fmt.channels));
  const data = Array.from({length: fmt.channels}, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) for (let c = 0; c < fmt.channels; c++) {
    const p = dataOff + (i * fmt.channels + c) * bytes;
    data[c]![i] = fmt.format === 3 ? b.readFloatLE(p) : b.readInt16LE(p) / 32768;
  }
  return {rate: fmt.rate, channels: fmt.channels, data};
}

export function writeWav16(file: string, pcm: Pcm) {
  const frames = pcm.data[0]!.length, ch = pcm.channels;
  const b = Buffer.alloc(44 + frames * ch * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + frames * ch * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(pcm.rate, 24); b.writeUInt32LE(pcm.rate * ch * 2, 28); b.writeUInt16LE(ch * 2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(frames * ch * 2, 40);
  for (let i = 0; i < frames; i++) for (let c = 0; c < ch; c++) {
    const v = Math.max(-1, Math.min(1, pcm.data[c]![i]!));
    b.writeInt16LE(Math.round(v * 32767), 44 + (i * ch + c) * 2);
  }
  writeFileSync(file, b);
}

// Deterministic PRNG (mulberry32) — all procedural audio/visual randomness is seeded.
export function prng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const normWord = (w: string) => w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
