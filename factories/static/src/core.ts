// Static Creative Factory core: brand kit + product database loading, formats, contrast, claims and variant selection.
import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const FACTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = path.resolve(FACTORY, '../..');
export const SHARED = path.join(REPO, 'factories', 'shared');

// ---------- formats (presets checked 2026-10-08 against secondary sources; marked VERIFY until official docs are confirmed) ----------
export type Format = {id: string; w: number; h: number; safe: {top: number; right: number; bottom: number; left: number}; note: string; text_allowed: boolean; white_bg?: boolean};
export const FORMATS: Record<string, Format> = {
  feed_4x5: {id: 'feed_4x5', w: 1080, h: 1350, safe: {top: 60, right: 72, bottom: 60, left: 72}, note: 'Instagram/Facebook feed 4:5 (VERIFY; Meta suggests 1440×1800 for ads — use scale 4/3)', text_allowed: true},
  grid_3x4: {id: 'grid_3x4', w: 1080, h: 1440, safe: {top: 72, right: 72, bottom: 72, left: 72}, note: 'Instagram 3:4 profile-grid format (VERIFY)', text_allowed: true},
  square: {id: 'square', w: 1080, h: 1080, safe: {top: 60, right: 60, bottom: 60, left: 60}, note: '1:1 feed/carousel card', text_allowed: true},
  story: {id: 'story', w: 1080, h: 1920, safe: {top: 270, right: 65, bottom: 672, left: 65}, note: 'Stories/Reels 9:16; keep critical content out of top 14%, bottom 35%, sides 6% (VERIFY)', text_allowed: true},
  link_191: {id: 'link_191', w: 1200, h: 628, safe: {top: 40, right: 48, bottom: 40, left: 48}, note: '1.91:1 link/banner', text_allowed: true},
  marketplace: {id: 'marketplace', w: 1200, h: 1200, safe: {top: 120, right: 120, bottom: 120, left: 120}, note: 'Mercado Livre/Shopee main image: pure white, product ~70–80% of frame, no promotional text (VERIFY per category)', text_allowed: false, white_bg: true},
};
export function customFormat(w: number, h: number): Format {
  if (!(w >= 200 && w <= 4096 && h >= 200 && h <= 4096)) throw new Error('custom format must be 200–4096 px');
  const m = Math.round(Math.min(w, h) * 0.06);
  return {id: `custom_${w}x${h}`, w, h, safe: {top: m, right: m, bottom: m, left: m}, note: 'custom', text_allowed: true};
}

// ---------- brand kit / product ----------
export type Kit = {
  brand_id: string; name: string; assets_private: boolean;
  logo: {asset: string; sha256: string; aspect_ratio: number; min_px: number; clearspace_ratio: number};
  palette: {tokens: Record<string, string>};
  typography: {family: string; roles: Record<string, {wdth: number; wght: number; tracking_em: number; uppercase?: boolean}>};
  compliance: {rules: string[]}; tone: {voice: string; avoid: string[]};
};
export type Claim = {claim_id: string; text: string; source_type: string; source_ref: string; approval: string};
export type Product = {brand_id: string; product_id: string; name: string; variant: string; claims: Claim[]; assets: Record<string, {sha256: string; local_path_hint: string; kind: string}>; usage: Record<string, string>};

export const sha256File = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const safeId = (s: string) => { if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(s)) throw new Error(`invalid id: ${s}`); return s; };

export function loadKit(brand: string): Kit { return JSON.parse(readFileSync(path.join(SHARED, 'brand-kits', safeId(brand), 'kit.json'), 'utf8')) as Kit; }
export function loadProduct(brand: string, product: string): Product { return JSON.parse(readFileSync(path.join(SHARED, 'products', safeId(brand), `${safeId(product)}.json`), 'utf8')) as Product; }

// Private brand assets are referenced by hash; the file must exist locally (or in the user's session) and match.
export function resolveAsset(p: Product, key: string): string {
  const a = p.assets[key];
  if (!a) throw new Error(`product has no asset ${key}`);
  const file = path.resolve(REPO, a.local_path_hint);
  if (!file.startsWith(REPO + path.sep)) throw new Error('asset path escapes repository');
  if (!existsSync(file)) throw new Error(`private asset ${key} not available here (expected ${a.local_path_hint}); provide it locally — brand assets are never stored in the public repo`);
  if (sha256File(file) !== a.sha256) throw new Error(`asset ${key} hash mismatch`);
  return file;
}

// ---------- claims ----------
export type CopyItem = {id: string; text: string; claim_refs: string[]};
export function validateCopy(items: CopyItem[], p: Product) {
  const ids = new Set(p.claims.map((c) => c.claim_id));
  const errors = items.flatMap((i) => i.claim_refs.filter((r) => !ids.has(r)).map((r) => `${i.id}: unknown claim ${r}`));
  return {ok: errors.length === 0, errors, pending: [...new Set(items.flatMap((i) => i.claim_refs).filter((r) => p.claims.find((c) => c.claim_id === r)?.approval !== 'USER_APPROVED'))]};
}

// ---------- contrast (WCAG 2.x) ----------
const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export function luminance(hex: string) {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) throw new Error(`bad color ${hex}`);
  const [r, g, b] = [m[1]!, m[2]!, m[3]!].map((x) => lin(parseInt(x, 16)));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };

// ---------- variant engine: enumerate, then pick a maximally diverse subset ----------
export type Dims = {concept: string[]; headline: string[]; cta: string[]; format: string[]};
export type Combo = {concept: string; headline: string; cta: string; format: string};
export const WEIGHTS = {concept: 4, headline: 2, cta: 1, format: 1};
export function enumerate(d: Dims): Combo[] {
  const out: Combo[] = [];
  for (const concept of d.concept) for (const headline of d.headline) for (const cta of d.cta) for (const format of d.format) out.push({concept, headline, cta, format});
  return out;
}
export const distance = (a: Combo, b: Combo) => (Object.keys(WEIGHTS) as (keyof Combo)[]).reduce((n, k) => n + (a[k] !== b[k] ? WEIGHTS[k] : 0), 0);
// Greedy farthest-point selection: each pick maximizes its minimum distance to the already selected set.
// Ties break by a prior score (e.g. concept fit) then by enumeration order, so selection is deterministic.
export function selectDiverse(all: Combo[], n: number, score: (c: Combo) => number = () => 0): Combo[] {
  if (!all.length) return [];
  const sorted = [...all].sort((a, b) => score(b) - score(a));
  const picked = [sorted[0]!];
  while (picked.length < Math.min(n, all.length)) {
    let best: Combo | null = null, bestD = -1, bestS = -Infinity;
    for (const c of sorted) {
      if (picked.includes(c)) continue;
      const d = Math.min(...picked.map((p) => distance(c, p))), s = score(c);
      if (d > bestD || (d === bestD && s > bestS)) { best = c; bestD = d; bestS = s; }
    }
    picked.push(best!);
  }
  return picked;
}
