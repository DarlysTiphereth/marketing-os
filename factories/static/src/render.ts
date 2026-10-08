// Renders HTML pieces with headless Chrome (playwright-core + an existing chrome-headless-shell: no browser download),
// measures the real layout in the page for QC, and exports PNG/JPG/WebP/PDF + editable source.
import {chromium, type Browser} from 'playwright-core';
import {copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {contrast, type Format} from './core.ts';
import {PACK} from './templates.ts';

export const TOOLS = {
  chrome: process.env.MOS_CHROME ?? (process.platform === 'win32' ? 'C:/Projects/media-stack-lab/experiments/remotion/node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe' : ''),
  ffmpeg: process.env.MOS_FFMPEG ?? (process.platform === 'win32' ? 'C:/Projects/media-stack-lab/.tools/ffmpeg/9.0.2/ffmpeg.exe' : 'ffmpeg'),
};

export async function openChrome(): Promise<Browser> {
  return chromium.launch({headless: true, ...(TOOLS.chrome ? {executablePath: TOOLS.chrome} : {}), args: ['--disable-gpu', '--font-render-hinting=none']});
}

type Box = {kind: string; text: string; x: number; y: number; w: number; h: number; fg?: string; bg?: string; fontSize?: number; weight?: string; natural?: number; rendered?: number; scale?: number; jug?: string; loaded?: boolean};
export type Check = {id: string; status: 'PASS' | 'WARN' | 'FAIL'; detail: string};

export async function renderPiece(browser: Browser, html: string, fmt: Format, workDir: string, name: string, scale = 1) {
  const htmlFile = path.join(workDir, `${name}.html`);
  writeFileSync(htmlFile, html);
  const page = await browser.newPage({viewport: {width: fmt.w, height: fmt.h}, deviceScaleFactor: scale});
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => errors.push(`failed to load ${path.basename(r.url())}`));
  await page.goto(pathToFileURL(htmlFile).href, {waitUntil: 'load'});
  await page.evaluate(() => document.fonts.ready);
  const fontOk = await page.evaluate(() => document.fonts.check("800 40px 'Archivo'"));
  const boxes: Box[] = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-qc]')].map((el) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el), d = el.dataset;
    const b: Record<string, unknown> = {kind: d.qc, text: (el.textContent ?? '').trim().slice(0, 80), x: r.left, y: r.top, w: r.width, h: r.height, fg: d.fg, bg: d.bg, fontSize: parseFloat(cs.fontSize), weight: cs.fontWeight};
    if (el instanceof HTMLImageElement) { b.natural = el.naturalWidth / Math.max(1, el.naturalHeight); b.rendered = r.width / Math.max(1, r.height); b.loaded = el.complete && el.naturalWidth > 0; }
    if (d.scale) b.scale = Number(d.scale);
    if (d.jug) b.jug = d.jug;
    return b;
  }) as never);
  const png = path.join(workDir, `${name}.png`);
  await page.screenshot({path: png, type: 'png', fullPage: false});
  await page.close();
  return {png, htmlFile, boxes, errors, fontOk};
}

// Visible jug box of a product <img> (the PNG has transparent padding).
const jugBox = (b: Box) => { const [x1, y1, jw, jh] = (b.jug ?? '').split(',').map(Number); const k = b.w / PACK.w; return {x: b.x + x1! * k, y: b.y + y1! * k, w: jw! * k, h: jh! * k}; };
const inter = (a: {x: number; y: number; w: number; h: number}, b: {x: number; y: number; w: number; h: number}) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

export function qcPiece(r: Awaited<ReturnType<typeof renderPiece>>, fmt: Format, opts: {allowTextOnProduct?: boolean} = {}): Check[] {
  const checks: Check[] = [];
  const add = (id: string, status: Check['status'], detail: string) => checks.push({id, status, detail});
  const texts = r.boxes.filter((b) => b.kind === 'text' || b.kind === 'cta');
  const s = fmt.safe;
  add('assets_loaded', r.errors.length ? 'FAIL' : 'PASS', r.errors.join('; ') || 'all images and fonts loaded');
  // Browsers only load fonts that are used: the check applies only when the piece has text.
  if (texts.length) add('brand_font', r.fontOk ? 'PASS' : 'FAIL', r.fontOk ? 'Archivo loaded' : 'font fell back');
  if (!fmt.text_allowed) add('no_text_required', texts.length ? 'FAIL' : 'PASS', `${texts.length} text elements (format forbids promotional text)`);
  const cut = texts.filter((b) => b.x < -0.5 || b.y < -0.5 || b.x + b.w > fmt.w + 0.5 || b.y + b.h > fmt.h + 0.5);
  add('text_cut', cut.length ? 'FAIL' : 'PASS', cut.map((b) => b.text).join(' | ') || 'no text outside the canvas');
  const margin = r.boxes.filter((b) => b.kind !== 'product').filter((b) => b.x < s.left - 1 || b.y < s.top - 1 || b.x + b.w > fmt.w - s.right + 1 || b.y + b.h > fmt.h - s.bottom + 1);
  add('safe_margins', margin.length ? 'FAIL' : 'PASS', margin.map((b) => `${b.kind}:"${b.text.slice(0, 24)}" @${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}×${Math.round(b.h)}`).join(' | ') || `inside safe area (${s.top}/${s.right}/${s.bottom}/${s.left})`);
  const overl: string[] = [];
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i]!, b = texts[j]!;
    if (a.text && b.text && (a.text.includes(b.text) || b.text.includes(a.text))) continue; // nested element
    const o = inter(a, b);
    if (o > 0.04 * Math.min(a.w * a.h, b.w * b.h)) overl.push(`"${a.text.slice(0, 20)}" × "${b.text.slice(0, 20)}"`);
  }
  add('text_overlap', overl.length ? 'FAIL' : 'PASS', overl.join(' | ') || 'no overlapping text blocks');
  const prods = r.boxes.filter((b) => b.kind === 'product');
  // Strict: any real intersection between text and the visible packaging box fails (found in visual review:
  // an 8%-of-headline threshold let the jug handle cross a headline line).
  const onProduct = texts.filter((t) => prods.some((p) => inter(t, jugBox(p)) > Math.min(400, 0.005 * t.w * t.h)));
  add('text_over_product', onProduct.length && !opts.allowTextOnProduct ? 'FAIL' : 'PASS', onProduct.map((b) => b.text.slice(0, 24)).join(' | ') || 'packaging not covered by text');
  const lowC = texts.filter((b) => b.fg && b.bg && b.fg.startsWith('#') && b.bg.startsWith('#')).map((b) => {
    const large = (b.fontSize ?? 0) >= 24 || ((b.fontSize ?? 0) >= 18.66 && Number(b.weight) >= 700);
    return {b, ratio: contrast(b.fg!, b.bg!), need: large ? 3 : 4.5};
  }).filter((x) => x.ratio < x.need);
  add('contrast', lowC.length ? 'FAIL' : 'PASS', lowC.map((x) => `"${x.b.text.slice(0, 20)}" ${x.ratio.toFixed(2)}<${x.need}`).join(' | ') || 'WCAG AA met for all declared text/background pairs');
  const small = texts.filter((b) => (b.fontSize ?? 99) < 18 * (fmt.w / 1080));
  add('legibility_min_size', small.length ? 'WARN' : 'PASS', small.map((b) => `${b.text.slice(0, 20)} ${b.fontSize}px`).join(' | ') || 'all text ≥ 18 px at 1080 width');
  const maxScale = Math.max(0, ...prods.map((p) => p.scale ?? 0));
  add('product_resolution', maxScale > 1.5 ? 'FAIL' : maxScale > 1.2 ? 'WARN' : 'PASS', `packshot upscaled ${maxScale.toFixed(2)}× (source jug ${PACK.y2 - PACK.y1 + 1}px tall)`);
  const logos = r.boxes.filter((b) => b.kind === 'logo');
  const bad = logos.filter((l) => Math.abs((l.rendered ?? 0) - (l.natural ?? 0)) / (l.natural ?? 1) > 0.01);
  add('logo_aspect', bad.length ? 'FAIL' : 'PASS', bad.length ? 'logo deformed' : `${logos.length} logo(s) at native aspect ratio`);
  const textArea = texts.reduce((n, b) => n + b.w * b.h, 0) / (fmt.w * fmt.h);
  add('text_density', textArea > 0.35 ? 'WARN' : 'PASS', `${(textArea * 100).toFixed(1)}% of canvas covered by text boxes`);
  return checks;
}

// 64-bit difference hash (9×8 grayscale) for repetitive-layout detection.
export function dhash(png: string): bigint {
  const r = spawnSync(TOOLS.ffmpeg, ['-v', 'error', '-i', png, '-vf', 'scale=9:8:flags=area,format=gray', '-f', 'rawvideo', '-'], {maxBuffer: 1 << 20});
  const px = r.stdout;
  let h = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) h = (h << 1n) | (px[y * 9 + x]! > px[y * 9 + x + 1]! ? 1n : 0n);
  return h;
}
export const hamming = (a: bigint, b: bigint) => { let x = a ^ b, n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n; };

export function exportFormats(png: string, outBase: string) {
  copyFileSync(png, `${outBase}.png`);
  const ff = (args: string[]) => spawnSync(TOOLS.ffmpeg, ['-v', 'error', '-y', '-i', png, ...args], {encoding: 'utf8'});
  ff(['-q:v', '2', '-pix_fmt', 'yuvj444p', `${outBase}.jpg`]);
  const webp = ff(['-c:v', 'libwebp', '-quality', '90', '-compression_level', '6', `${outBase}.webp`]);
  return {png: `${outBase}.png`, jpg: `${outBase}.jpg`, webp: webp.status === 0 ? `${outBase}.webp` : null};
}

// PDF from rendered pages (Chrome print-to-PDF, one page per image at exact pixel size).
export async function pdfFromImages(browser: Browser, images: string[], fmt: Format, out: string, workDir: string) {
  const html = `<!doctype html><html><head><style>@page{size:${fmt.w}px ${fmt.h}px;margin:0}*{margin:0;padding:0}img{display:block;width:${fmt.w}px;height:${fmt.h}px;page-break-after:always}</style></head><body>${images.map((i) => `<img src="${pathToFileURL(i).href}">`).join('')}</body></html>`;
  const f = path.join(workDir, 'pdf.html');
  writeFileSync(f, html);
  const page = await browser.newPage();
  await page.goto(pathToFileURL(f).href, {waitUntil: 'load'});
  await page.pdf({path: out, width: `${fmt.w}px`, height: `${fmt.h}px`, printBackground: true, margin: {top: '0', right: '0', bottom: '0', left: '0'}});
  await page.close();
  return out;
}

export function sheet(images: string[], out: string, cols = 6) {
  const dir = path.join(path.dirname(out), '_sheet');
  mkdirSync(dir, {recursive: true});
  // Normalize each image first: the image2 demuxer cannot tile frames of different sizes.
  images.forEach((img, i) => spawnSync(TOOLS.ffmpeg, ['-v', 'error', '-y', '-i', img, '-vf', 'scale=w=300:h=400:force_original_aspect_ratio=decrease,pad=300:400:(ow-iw)/2:(oh-ih)/2:color=0xeeeeee', path.join(dir, `s-${String(i).padStart(3, '0')}.png`)]));
  const rows = Math.ceil(images.length / cols);
  spawnSync(TOOLS.ffmpeg, ['-v', 'error', '-y', '-i', path.join(dir, 's-%03d.png'), '-vf', `tile=${cols}x${rows}:padding=8:color=white`, '-frames:v', '1', '-q:v', '3', out]);
  rmSync(dir, {recursive: true, force: true});
  return existsSync(out) ? out : null;
}
export const readJson = <T>(p: string) => JSON.parse(readFileSync(p, 'utf8')) as T;
