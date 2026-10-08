// Generates TEST_FIXTURE / NOT_REAL_PRODUCT_DATA placeholder PNGs (no brand, no real product).
// Pure Node (zlib) so it runs identically on Windows and Linux workers. Output is committed; re-run only to change the art.
import {deflateSync} from 'node:zlib';
import {mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets');
type Px = (x: number, y: number) => [number, number, number, number];

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (b: Buffer) => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255]! ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(file: string, w: number, h: number, px: Px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) { const [r, g, b, a] = px(x, y); raw.set([r, g, b, a], y * (w * 4 + 1) + 1 + x * 4); }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  writeFileSync(path.join(OUT, file), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, {level: 9})), chunk('IEND', Buffer.alloc(0))]));
}
// Signed distance to a rounded box, antialiased coverage.
const rbox = (x: number, y: number, cx: number, cy: number, hw: number, hh: number, r: number) => {
  const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
const cov = (d: number) => Math.max(0, Math.min(1, 0.5 - d));
const over = (dst: [number, number, number, number], [r, g, b]: [number, number, number], a: number): [number, number, number, number] => {
  const A = a + dst[3] / 255 * (1 - a);
  if (A <= 0) return [0, 0, 0, 0];
  const mix = (s: number, d: number) => Math.round((s * a + d * (dst[3] / 255) * (1 - a)) / A);
  return [mix(r, dst[0]), mix(g, dst[1]), mix(b, dst[2]), Math.round(A * 255)];
};

mkdirSync(OUT, {recursive: true});
// Product placeholder: neutral grey bottle with hatched "placeholder" label band.
png('product.png', 800, 800, (x, y) => {
  let p: [number, number, number, number] = [0, 0, 0, 0];
  p = over(p, [150, 158, 172], cov(rbox(x, y, 400, 470, 165, 260, 60)));
  p = over(p, [120, 128, 142], cov(rbox(x, y, 400, 185, 60, 40, 12)));
  p = over(p, [70, 76, 88], cov(rbox(x, y, 400, 140, 70, 22, 8)));
  const band = cov(rbox(x, y, 400, 500, 150, 110, 10));
  const hatch = (Math.floor((x + y) / 14) % 2) ? [235, 236, 240] as [number, number, number] : [210, 212, 220] as [number, number, number];
  p = over(p, hatch, band);
  return p;
});
png('logo.png', 300, 310, (x, y) => over([0, 0, 0, 0], [120, 128, 142], cov(Math.hypot(x - 150, y - 155) - 120)));
for (const [name, k] of [['icon_shirt', 0], ['icon_leaf', 1], ['icon_sparkle', 2]] as const)
  png(`${name}.png`, 84, 84, (x, y) => over(over([90, 96, 110, 255], [210, 212, 220], cov(Math.abs(Math.hypot(x - 42, y - 42) - 34) - 3)), [210, 212, 220], cov(rbox(x, y, 42, 42, 8 + k * 4, 8 + k * 4, 3))));
console.log('fixture assets written to', OUT);
