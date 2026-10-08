// Fast visual iteration: build the timeline, render stills at each scene's text beats, tile into one sheet.
// Usage: node pipeline/preview.ts --hook hook-a --body body-1 --cta cta-a [--out <dir>] [--scenes b1-reveal,cta-a]
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {mkdirSync, readFileSync, rmSync} from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {ROOT, TOOLS, run, sha256, writeJson} from './lib.ts';
import {expand, loadTemplate, variantId} from './variants.ts';
import {synthesize} from './voice.ts';
import {buildTimeline} from './timeline.ts';
import {browserOptions, getBundle} from './render.ts';

const {values: a} = parseArgs({options: {
  creative: {type: 'string', default: 'creatives/grand-sabao-5l.creative.json'},
  hook: {type: 'string', default: 'hook-a'}, body: {type: 'string', default: 'body-1'}, cta: {type: 'string', default: 'cta-a'},
  style: {type: 'string', default: 'deep-blue'}, voice: {type: 'string', default: 'maria'}, music: {type: 'string', default: 'pulse-116'},
  pacing: {type: 'string', default: 'standard'}, captions: {type: 'string', default: 'karaoke'}, out: {type: 'string'}, scenes: {type: 'string'},
}});
const raw = readFileSync(path.resolve(ROOT, a.creative!));
const t = loadTemplate(JSON.parse(raw.toString('utf8')));
const ex = expand(t, {hook: a.hook, body: a.body, cta: a.cta, style: a.style, voice: a.voice, music: a.music, pacing: a.pacing, captions: a.captions});
const lines = ex.scenes.map((s) => synthesize(s.voiceover, ex.voice.voice_name, ex.voice.rate_pct + (ex.sel.pacing === 'fast' ? 8 : 0), ex.voice.provider));
const tl = buildTimeline({variant_id: variantId(sha256(raw), ex.sel), creative_id: t.creative_id, selection: ex.sel, style: ex.style, scenes: ex.scenes, lines, fps: 30, assets: Object.fromEntries(Object.entries(t.assets).map(([k, v]) => [k, path.basename(v.path)])), display: t.display});
const out = path.resolve(a.out ?? path.join(ROOT, '.cache/preview'));
rmSync(out, {recursive: true, force: true});
mkdirSync(out, {recursive: true});
writeJson(path.join(out, 'timeline.json'), tl);
const only = a.scenes ? new Set(a.scenes.split(',')) : null;
const frames: number[] = [];
for (const s of tl.scenes) {
  if (only && !only.has(s.scene_id)) continue;
  const f0 = Math.round(s.start * 30), d = Math.round(s.duration * 30);
  const pts = [Math.min(d - 1, 3), ...s.beats.map((b) => Math.round(b * 30) + 12), d - 2].filter((x) => x >= 0 && x < d);
  for (const p of [...new Set(pts)]) frames.push(f0 + p);
}
const serveUrl = await getBundle();
const browser = await openBrowser('chrome', browserOptions());
const inputProps = tl as unknown as Record<string, unknown>;
const composition = await selectComposition({serveUrl, id: 'Ad', inputProps, puppeteerInstance: browser, ...browserOptions()});
let k = 0;
for (const f of frames) {
  await renderStill({composition, serveUrl, inputProps, frame: f, output: path.join(out, `p-${String(k++).padStart(3, '0')}.jpeg`), imageFormat: 'jpeg', jpegQuality: 85, puppeteerInstance: browser, ...browserOptions()});
}
await browser.close({silent: true});
const cols = Math.min(6, frames.length), rows = Math.ceil(frames.length / cols);
run(TOOLS.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', path.join(out, 'p-%03d.jpeg'), '-vf', `scale=300:-1,tile=${cols}x${rows}:padding=6:color=white`, '-frames:v', '1', path.join(out, 'sheet.jpg')]);
console.log(JSON.stringify({duration: tl.duration, scenes: tl.scenes.map((s) => ({id: s.scene_id, start: s.start, dur: s.duration, beats: s.beats.map((b) => +b.toFixed(2))})), frames, sheet: path.join(out, 'sheet.jpg')}, null, 1));
