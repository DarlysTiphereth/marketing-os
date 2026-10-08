// Render stage: Remotion renders frames in headless Chrome; the *external* FFmpeg encodes + muxes.
// Rationale (OBSERVED in media-stack-lab S004): Windows Application Control blocks Remotion's bundled
// compositor/FFmpeg (NotSigned). renderFrames does not need it, so encoding is delegated.
import {bundle} from '@remotion/bundler';
import {openBrowser, renderFrames, selectComposition} from '@remotion/renderer';
import {existsSync, mkdirSync, readdirSync, rmSync} from 'node:fs';
import path from 'node:path';
import {ROOT, TOOLS, run} from './lib.ts';
import type {Timeline} from '../src/schema.ts';

// Bundles are cached by (code fingerprint, asset set) in a managed dir instead of leaking a new
// remotion-webpack-bundle-* folder into %TEMP% on every run (observed: 11 folders / 307 MB in Benchmark 001).
const bundled = new Map<string, string>();
export async function getBundle(opts: {publicDir?: string; outDir?: string} = {}) {
  const publicDir = opts.publicDir ?? path.join(ROOT, 'public');
  const key = opts.outDir ?? publicDir;
  if (bundled.has(key)) return bundled.get(key)!;
  let url: string;
  if (opts.outDir && existsSync(path.join(opts.outDir, 'index.html'))) url = opts.outDir;
  else url = await bundle({entryPoint: path.join(ROOT, 'src/index.tsx'), publicDir, ...(opts.outDir ? {outDir: opts.outDir} : {})});
  bundled.set(key, url);
  return url;
}
export const browserOptions = () => ({...(TOOLS.chrome ? {browserExecutable: TOOLS.chrome} : {}), chromeMode: 'headless-shell' as const, logLevel: 'error' as const});
// renderFrames/selectComposition can (re)open their OWN browser (e.g. after a page crash) using their own
// browserExecutable option — not the puppeteerInstance's. Without this they silently download Chrome into
// <cwd>/node_modules/.remotion (observed: 281.6 MB in Benchmark 001/cloud-first test A).
const pinnedBrowser = () => ({...(TOOLS.chrome ? {browserExecutable: TOOLS.chrome} : {}), chromeMode: 'headless-shell' as const});

export async function renderVideoFrames(tl: Timeline, framesDir: string, opts: {concurrency?: number; frameRange?: [number, number] | number; serveUrl?: string} = {}) {
  rmSync(framesDir, {recursive: true, force: true});
  mkdirSync(framesDir, {recursive: true});
  const serveUrl = opts.serveUrl ?? await getBundle();
  const browser = await openBrowser('chrome', browserOptions());
  const warnings: string[] = [];
  try {
    const inputProps = tl as unknown as Record<string, unknown>;
    const composition = await selectComposition({serveUrl, id: 'Ad', inputProps, puppeteerInstance: browser, ...pinnedBrowser()});
    const res = await renderFrames({
      composition, serveUrl, inputProps, outputDir: framesDir, imageFormat: 'jpeg', jpegQuality: 93, puppeteerInstance: browser,
      concurrency: opts.concurrency ?? 4, frameRange: opts.frameRange ?? null, ...pinnedBrowser(), onStart: () => {}, onFrameUpdate: () => {},
      onBrowserLog: (l) => { if (l.type === 'error' || l.type === 'warning') warnings.push(`${l.type}: ${l.text}`.slice(0, 400)); },
    });
    const files = readdirSync(framesDir).filter((f) => f.endsWith('.jpeg')).sort();
    return {frames: files.length, durationInFrames: composition.durationInFrames, warnings, assetsInfo: res.assetsInfo ? 'ok' : 'none', files};
  } finally {
    await browser.close({silent: true});
  }
}

export function encode(framesDir: string, files: string[], audioWav: string, out: string, fps: number) {
  // Remotion names frames element-<zero-padded index>.jpeg
  const first = files[0]!;
  const digits = first.replace(/^element-/, '').replace(/\.jpeg$/, '').length;
  const pattern = path.join(framesDir, `element-%0${digits}d.jpeg`);
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(fps), '-i', pattern, '-i', audioWav,
    '-map', '0:v:0', '-map', '1:a:0', '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-r', String(fps), '-g', String(fps * 2), '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-shortest', '-movflags', '+faststart',
    '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:v', '+bitexact', '-flags:a', '+bitexact', // byte-reproducible output → CAS dedup works
    '-metadata', 'comment=Marketing OS - internal, not for publication', out];
  run(TOOLS.ffmpeg, args);
  return {ffmpeg_args: args.map((a) => (a.includes(path.sep) || a.includes('/') ? path.basename(a) : a))};
}
