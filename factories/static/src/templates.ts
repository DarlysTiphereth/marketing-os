// HTML/CSS templates. Each concept is a different art direction (composition, grid, type scale, light), not a recolor.
// QC hooks: data-qc="text|cta|logo|product" + data-fg/data-bg declare the colors a text sits on (for WCAG checks).
import type {Format, Kit} from './core.ts';

// Visible packshot box inside the 800×800 PNG (measured with ffmpeg alphaextract,bbox).
export const PACK = {w: 800, h: 800, x1: 292, x2: 553, y1: 59, y2: 748};
const jugW = PACK.x2 - PACK.x1 + 1, jugHpx = PACK.y2 - PACK.y1 + 1;

export type Copy = {headline: string; cta: string; band?: string; eyebrow?: string; benefits?: {icon: string; text: string}[]; footnote?: string};
export type Ctx = {kit: Kit; fmt: Format; files: Record<string, string>; display: {brand: string; tagline: string; product: string; variant: string}};

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// *word* marks the accent word in a headline.
export const accent = (s: string, cls = 'acc') => esc(s).replace(/\*(.+?)\*/g, `<span class="${cls}">$1</span>`);
const plain = (s: string) => s.replace(/\*/g, '');

export function productEl(ctx: Ctx, o: {jugH: number; cx: number; baseY: number; reflection?: number; shadow?: number; rot?: number; cls?: string}) {
  const S = o.jugH / (jugHpx / PACK.h);
  const left = o.cx - ((PACK.x1 + jugW / 2) / PACK.w) * S, top = o.baseY - ((PACK.y2 + 1) / PACK.h) * S;
  const scale = o.jugH / jugHpx;
  const shadow = o.shadow ?? 0.55, refl = o.reflection ?? 0;
  const sw = (jugW / PACK.w) * S * 1.25;
  return `
  <div class="shadow" style="left:${o.cx - sw / 2}px;top:${o.baseY - sw * 0.09}px;width:${sw}px;height:${sw * 0.18}px;opacity:${shadow}"></div>
  ${refl ? `<img class="reflect" src="${ctx.files.packshot}" style="left:${left}px;top:${2 * o.baseY - top - S}px;width:${S}px;height:${S}px;opacity:${refl}">` : ''}
  <img class="product ${o.cls ?? ''}" data-qc="product" data-scale="${scale.toFixed(3)}" data-jug="${PACK.x1},${PACK.y1},${jugW},${jugHpx}" src="${ctx.files.packshot}"
    style="left:${left}px;top:${top}px;width:${S}px;height:${S}px;${o.rot ? `transform:rotate(${o.rot}deg);transform-origin:50% 93%;` : ''}">`;
}

export function base(ctx: Ctx, css: string, body: string, title: string) {
  const t = ctx.kit.palette.tokens, r = ctx.kit.typography.roles;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
@font-face{font-family:'Archivo';src:url('${ctx.files.font}') format('woff2-variations');font-weight:100 900;font-stretch:62% 125%;font-style:normal}
:root{--navy:${t.navy};--royal:${t.royal};--electric:${t.electric};--aqua:${t.aqua};--mist:${t.mist};--gold:${t.gold};--gold-deep:${t.gold_deep};--white:${t.white};--ink:${t.ink};--W:${ctx.fmt.w}px;--H:${ctx.fmt.h}px}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${ctx.fmt.w}px;height:${ctx.fmt.h}px;overflow:hidden;background:#000}
.canvas{position:relative;width:${ctx.fmt.w}px;height:${ctx.fmt.h}px;overflow:hidden;font-family:'Archivo',Arial,sans-serif;font-synthesis:none;-webkit-font-smoothing:antialiased}
.display{font-stretch:${r.display!.wdth}%;font-weight:${r.display!.wght};letter-spacing:${r.display!.tracking_em}em;line-height:.93;text-wrap:balance}
.headline{font-stretch:${r.headline!.wdth}%;font-weight:${r.headline!.wght};letter-spacing:${r.headline!.tracking_em}em;line-height:1.02;text-wrap:balance}
.body{font-stretch:${r.body!.wdth}%;font-weight:${r.body!.wght};line-height:1.35}
.label{font-stretch:${r.label!.wdth}%;font-weight:${r.label!.wght};letter-spacing:${r.label!.tracking_em}em;text-transform:uppercase}
.product,.reflect{position:absolute;display:block;max-width:none}
.reflect{transform:scaleY(-1);-webkit-mask-image:linear-gradient(to top,rgba(0,0,0,.55),transparent 22%);mask-image:linear-gradient(to top,rgba(0,0,0,.55),transparent 22%);filter:blur(1px)}
.shadow{position:absolute;border-radius:50%;background:radial-gradient(closest-side,rgba(0,6,30,.85),rgba(0,6,30,.35) 55%,transparent);filter:blur(6px)}
.abs{position:absolute}
.logo{position:absolute;object-fit:contain;border-radius:18%}
.band{display:inline-flex;align-items:center;padding:.62em 1.5em;border-radius:999px;background:linear-gradient(180deg,#0b2f9a,var(--navy));border:3px solid var(--gold);color:#fff;white-space:nowrap}
.pill{display:inline-flex;align-items:center;gap:.5em;padding:.72em 1.5em;border-radius:999px;white-space:nowrap}
.acc{color:var(--gold)}
${css}
</style></head><body><div class="canvas">${body}</div></body></html>`;
}

export const logoEl = (ctx: Ctx, x: number, y: number, size: number) => `<img class="logo" data-qc="logo" data-ar="${ctx.kit.logo.aspect_ratio}" src="${ctx.files.logo}" style="left:${x}px;top:${y}px;width:${size * ctx.kit.logo.aspect_ratio}px;height:${size}px">`;

// ============ Concept 1 — Hero Spotlight: dark studio, single light, product as the subject ============
export function heroSpotlight(ctx: Ctx, c: Copy) {
  const {w, h, safe} = ctx.fmt, u = Math.min(w, h) / 1080, tall = h / w > 1.5;
  const floorY = Math.round(h * (tall ? 0.6 : 0.79));
  const jugH = Math.round(Math.min(h * (tall ? 0.42 : 0.5), 760 * u));
  const top = safe.top + 4 * u;
  const css = `
.bg{position:absolute;inset:0;background:radial-gradient(ellipse 70% 55% at 50% ${Math.round(floorY / h * 100) - 22}%,#2a6cf0 0%,#0a3fc2 30%,#052069 62%,#020a2e 100%)}
.floor{position:absolute;left:0;right:0;top:${floorY}px;bottom:0;background:linear-gradient(180deg,#0a2a86 0%,#03123f 55%,#010820 100%)}
.horizon{position:absolute;left:0;right:0;top:${floorY - 1}px;height:2px;background:linear-gradient(90deg,transparent,rgba(160,205,255,.55),transparent)}
.beam{position:absolute;left:50%;top:-10%;width:${560 * u}px;height:${floorY + 40}px;transform:translateX(-50%);background:linear-gradient(180deg,rgba(150,200,255,.0),rgba(150,200,255,.16) 60%,rgba(150,200,255,.0));filter:blur(18px)}
.caustic{position:absolute;inset:0;opacity:.22;background:repeating-radial-gradient(circle at 30% ${floorY / h * 100 + 8}%,rgba(140,200,255,.0) 0 22px,rgba(140,200,255,.35) 23px 25px,rgba(140,200,255,0) 26px 48px);-webkit-mask-image:linear-gradient(180deg,transparent ${floorY / h * 100}%,#000 ${floorY / h * 100 + 6}%,transparent);mask-image:linear-gradient(180deg,transparent ${floorY / h * 100}%,#000 ${floorY / h * 100 + 6}%,transparent)}
.h1{left:${safe.left}px;right:${safe.right}px;top:${top + 100 * u}px;text-align:center;color:#fff;font-size:${fit(c.headline, tall ? 104 : 84) * u}px;text-shadow:0 ${6 * u}px ${30 * u}px rgba(0,0,30,.45)}
.brandline{left:${safe.left + 96 * u}px;top:${top + 18 * u}px;color:#cfe0ff;font-size:${22 * u}px}
.bandwrap{left:0;right:0;top:${floorY + (tall ? 70 : 36) * u}px;display:flex;justify-content:center;font-size:${26 * u}px}
.ctawrap{left:0;right:0;top:${floorY + (tall ? 170 : 128) * u}px;display:flex;justify-content:center;font-size:${34 * u}px}
.cta{background:var(--gold);color:var(--navy);box-shadow:0 ${12 * u}px ${30 * u}px rgba(224,173,69,.35)}`;
  const body = `<div class="bg"></div><div class="beam"></div><div class="floor"></div><div class="caustic"></div><div class="horizon"></div>
  ${logoEl(ctx, safe.left, top, 76 * u)}
  <div class="abs label brandline" data-qc="text" data-fg="#cfe0ff" data-bg="#052069">${esc(ctx.display.brand)} · ${esc(ctx.display.tagline)}</div>
  <h1 class="abs display h1" data-qc="text" data-fg="#ffffff" data-bg="#0a3fc2">${accent(c.headline)}</h1>
  ${productEl(ctx, {jugH, cx: w / 2, baseY: floorY + 6 * u, reflection: 0.5, shadow: 0.75})}
  ${c.band ? `<div class="abs bandwrap"><span class="band label" data-qc="text" data-fg="#ffffff" data-bg="#04124a">${esc(c.band)}</span></div>` : ''}
  <div class="abs ctawrap"><span class="pill headline cta" data-qc="cta" data-fg="${ctx.kit.palette.tokens.navy}" data-bg="${ctx.kit.palette.tokens.gold}">${esc(c.cta)} <span aria-hidden="true">→</span></span></div>`;
  return base(ctx, css, body, plain(c.headline));
}

// ============ Concept 2 — Editorial Split: asymmetric grid, typographic column, product straddling a color field ============
export function editorialSplit(ctx: Ctx, c: Copy) {
  const {w, h, safe} = ctx.fmt, u = Math.min(w, h) / 1080, tall = h / w > 1.5;
  const fieldX = Math.round(w * (tall ? 0.36 : 0.58));
  const baseY = Math.round(h * (tall ? 0.6 : 0.86));
  const jugH = Math.round(Math.min(h * (tall ? 0.4 : 0.56), 760 * u));
  const colW = tall ? w - safe.left - safe.right : fieldX - safe.left - 40 * u;
  const css = `
.bg{position:absolute;inset:0;background:var(--mist)}
.field{position:absolute;left:${fieldX}px;top:0;right:0;bottom:0;background:linear-gradient(160deg,#1d6dff 0%,#0a3fc2 45%,#04124a 100%)}
.field::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 80% 40% at 40% ${baseY / h * 100}%,rgba(140,200,255,.35),transparent 70%)}
.rule{left:${safe.left}px;top:${safe.top + 70 * u}px;width:${64 * u}px;height:${4 * u}px;background:var(--gold)}
.eyebrow{left:${safe.left}px;top:${safe.top + 92 * u}px;font-size:${22 * u}px;color:var(--royal)}
.h1{left:${safe.left}px;top:${safe.top + 140 * u}px;width:${colW}px;font-size:${fit(c.headline, tall ? 92 : 78) * u}px;color:var(--navy)}
.h1 .acc{color:var(--royal)}
.list{left:${safe.left}px;top:${tall ? Math.round(h * 0.64) : Math.round(safe.top + 470 * u)}px;width:${colW}px;display:flex;flex-direction:column;gap:${18 * u}px}
.row{display:flex;align-items:center;gap:${20 * u}px;font-size:${27 * u}px;color:var(--ink)}
.row img{width:${64 * u}px;height:${64 * u}px;border-radius:50%;flex:none}
.ctawrap{left:${safe.left}px;top:${tall ? Math.round(h * 0.64 + 270 * u) : h - safe.bottom - 96 * u}px;font-size:${30 * u}px}
.cta{background:var(--navy);color:#fff}
.tag{right:${safe.right}px;top:${safe.top}px;font-size:${20 * u}px;color:#dbe8ff}`;
  const body = `<div class="bg"></div><div class="field"></div>
  <div class="abs rule"></div>
  <div class="abs label eyebrow" data-qc="text" data-fg="${ctx.kit.palette.tokens.royal}" data-bg="${ctx.kit.palette.tokens.mist}">${esc(c.eyebrow ?? ctx.display.product)}</div>
  <h1 class="abs headline h1" data-qc="text" data-fg="${ctx.kit.palette.tokens.navy}" data-bg="${ctx.kit.palette.tokens.mist}">${accent(c.headline)}</h1>
  ${productEl(ctx, {jugH, cx: tall ? w * 0.68 : fieldX + (w - fieldX) / 2, baseY, reflection: 0, shadow: 0.5})}
  ${c.benefits?.length ? `<div class="abs list">${c.benefits.map((b) => `<div class="row body" data-qc="text" data-fg="${ctx.kit.palette.tokens.ink}" data-bg="${ctx.kit.palette.tokens.mist}"><img src="${ctx.files[b.icon]}" alt="">${esc(b.text)}</div>`).join('')}</div>` : ''}
  <div class="abs ctawrap"><span class="pill headline cta" data-qc="cta" data-fg="#ffffff" data-bg="${ctx.kit.palette.tokens.navy}">${esc(c.cta)} <span aria-hidden="true">→</span></span></div>
  ${logoEl(ctx, w - safe.right - 64 * u * ctx.kit.logo.aspect_ratio, h - safe.bottom - 64 * u, 64 * u)}`;
  return base(ctx, css, body, plain(c.headline));
}

// ============ Concept 3 — Bold Block: color blocking, oversized volume numeral, sticker CTA ============
export function boldBlock(ctx: Ctx, c: Copy) {
  const {w, h, safe} = ctx.fmt, u = Math.min(w, h) / 1080, tall = h / w > 1.5;
  const baseY = Math.round(h * (tall ? 0.6 : 0.9));
  const jugH = Math.round(Math.min(h * (tall ? 0.3 : 0.56), 760 * u));
  const numTop = tall ? h * 0.22 : h * 0.24;
  const css = `
.bg{position:absolute;inset:0;background:var(--electric)}
.diag{position:absolute;left:-10%;right:-10%;top:${Math.round(h * 0.52)}px;height:${Math.round(h * 0.9)}px;background:var(--navy);transform:rotate(-8deg);transform-origin:0 0}
.num{left:0;right:0;top:${numTop}px;text-align:center;font-stretch:125%;font-weight:900;font-size:${(tall ? 560 : 520) * u}px;line-height:.8;letter-spacing:-.05em;color:var(--gold)}
.h1{left:${safe.left}px;right:${safe.right}px;top:${safe.top + 10 * u}px;color:#fff;font-size:${(tall ? 64 : 70) * u}px;text-transform:uppercase}
.sticker{width:${230 * u}px;height:${230 * u}px;border-radius:50%;background:var(--gold);color:var(--navy);display:grid;place-items:center;text-align:center;font-size:${30 * u}px;line-height:1.05;transform:rotate(-12deg);box-shadow:0 ${14 * u}px ${30 * u}px rgba(0,0,40,.35);padding:${22 * u}px}
.stickwrap{right:${safe.right + 45 * u}px;top:${tall ? Math.round(safe.top + 330 * u) : Math.round(h * 0.62)}px}
.foot{left:${safe.left}px;bottom:${safe.bottom}px;color:#cfe0ff;font-size:${22 * u}px}`;
  const body = `<div class="bg"></div><div class="diag"></div>
  <div class="abs num" aria-hidden="true">5L</div>
  <h1 class="abs display h1" data-qc="text" data-fg="#ffffff" data-bg="${ctx.kit.palette.tokens.electric}">${accent(c.headline, 'acc')}</h1>
  ${productEl(ctx, {jugH, cx: w * (tall ? 0.38 : 0.42), baseY, reflection: 0, shadow: 0.6, rot: -4})}
  <div class="abs stickwrap"><div class="sticker headline" data-qc="cta" data-fg="${ctx.kit.palette.tokens.navy}" data-bg="${ctx.kit.palette.tokens.gold}">${esc(c.cta)}</div></div>
  <div class="abs label foot" data-qc="text" data-fg="#cfe0ff" data-bg="${ctx.kit.palette.tokens.navy}">${esc(ctx.display.brand)} · ${esc(ctx.display.product)}</div>`;
  return base(ctx, css, body, plain(c.headline));
}

// ============ Concept 4 — Catalog Clean: white, product-first, specification rhythm (marketplace-friendly) ============
export function catalogClean(ctx: Ctx, c: Copy) {
  const {w, h, safe} = ctx.fmt, u = Math.min(w, h) / 1080;
  const noText = !ctx.fmt.text_allowed;
  const ctaTop = h - safe.bottom - 78 * u, specsTop = ctaTop - 170 * u;
  const baseY = Math.round(noText ? h / 2 + (h * 0.76) / 2 : specsTop - 36 * u);
  const jugH = Math.round(noText ? h * 0.76 : Math.min(760 * u, baseY - safe.top - 200 * u));
  const css = `
.bg{position:absolute;inset:0;background:#ffffff}
.h1{left:${safe.left}px;right:${safe.right}px;top:${safe.top + 20 * u}px;text-align:center;font-size:${64 * u}px;color:var(--navy)}
.h1 .acc{color:var(--royal)}
.specs{left:${safe.left}px;right:${safe.right}px;top:${specsTop}px;display:flex;justify-content:center;gap:${36 * u}px}
.spec{display:flex;flex-direction:column;align-items:center;gap:${10 * u}px;font-size:${20 * u}px;color:var(--ink);width:${210 * u}px;text-align:center}
.spec img{width:${68 * u}px;height:${68 * u}px;border-radius:50%}
.ctawrap{left:0;right:0;bottom:${safe.bottom}px;display:flex;justify-content:center;font-size:${28 * u}px}
.cta{border:3px solid var(--navy);color:var(--navy)}`;
  const body = `<div class="bg"></div>
  ${noText ? '' : `<h1 class="abs headline h1" data-qc="text" data-fg="${ctx.kit.palette.tokens.navy}" data-bg="#ffffff">${accent(c.headline)}</h1>`}
  ${productEl(ctx, {jugH, cx: w / 2, baseY, reflection: 0, shadow: noText ? 0.18 : 0.3})}
  ${noText || !c.benefits?.length ? '' : `<div class="abs specs">${c.benefits.map((b) => `<div class="spec label" data-qc="text" data-fg="${ctx.kit.palette.tokens.ink}" data-bg="#ffffff"><img src="${ctx.files[b.icon]}" alt="">${esc(b.text)}</div>`).join('')}</div>`}
  ${noText ? '' : `<div class="abs ctawrap"><span class="pill headline cta" data-qc="cta" data-fg="${ctx.kit.palette.tokens.navy}" data-bg="#ffffff">${esc(c.cta)} <span aria-hidden="true">→</span></span></div>`}`;
  return base(ctx, css, body, plain(c.headline || ctx.display.product));
}

// ============ A — Commercial photo composite: no text, studio light, glossy floor, water droplets ============
export function photoComposite(ctx: Ctx) {
  const {w, h} = ctx.fmt, u = Math.min(w, h) / 1080;
  const floorY = Math.round(h * 0.7), jugH = Math.round(Math.min(h * 0.55, 740 * u));
  const drops = Array.from({length: 14}, (_, i) => {
    const r = [7, 4, 10, 5, 3, 8, 6, 4, 12, 5, 3, 7, 9, 4][i]! * u, x = [180, 230, 300, 760, 820, 880, 140, 690, 920, 360, 640, 260, 790, 420][i]! / 1080 * w, y = floorY + [40, 90, 150, 60, 120, 180, 210, 230, 260, 280, 300, 330, 350, 380][i]! * u;
    return `<div class="drop" style="left:${x}px;top:${y}px;width:${r * 2}px;height:${r * 1.2}px"></div>`;
  }).join('');
  const css = `
.bg{position:absolute;inset:0;background:radial-gradient(ellipse 80% 60% at 50% 38%,#3d82ff 0%,#0f4fd6 28%,#062a8c 58%,#020d3a 100%)}
.rim{position:absolute;top:${h * 0.08}px;width:${150 * u}px;height:${floorY - h * 0.08}px;background:linear-gradient(180deg,rgba(255,255,255,0),rgba(220,235,255,.55) 45%,rgba(255,255,255,0));filter:blur(${28 * u}px)}
.floor{position:absolute;left:0;right:0;top:${floorY}px;bottom:0;background:linear-gradient(180deg,#0b2e93 0%,#041656 40%,#010722 100%)}
.sheen{position:absolute;left:10%;right:10%;top:${floorY}px;height:${120 * u}px;background:radial-gradient(ellipse at 50% 0,rgba(170,210,255,.45),transparent 70%)}
.drop{position:absolute;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.95) 0 18%,rgba(170,210,255,.55) 35%,rgba(10,40,140,.25) 70%,transparent 72%);box-shadow:0 ${2 * u}px ${3 * u}px rgba(0,0,20,.4)}
.vignette{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,transparent 55%,rgba(0,0,15,.55))}`;
  const body = `<div class="bg"></div><div class="rim" style="left:${w * 0.27}px"></div><div class="rim" style="left:${w * 0.63}px"></div>
  <div class="floor"></div><div class="sheen"></div>${drops}
  ${productEl(ctx, {jugH, cx: w / 2, baseY: floorY + 8 * u, reflection: 0.55, shadow: 0.8})}
  <div class="vignette"></div>`;
  return base(ctx, css, body, `${ctx.display.product} — composição digital`);
}

// Long headlines step down in size so the type scale holds without orphans.
export function fit(text: string, base: number) { const n = plain(text).length; return n <= 26 ? base : Math.round(base * Math.max(0.72, 26 / n)); }

export const CONCEPTS = {'hero-spotlight': heroSpotlight, 'editorial-split': editorialSplit, 'bold-block': boldBlock, 'catalog-clean': catalogClean} as const;
export type ConceptId = keyof typeof CONCEPTS;
export const CONCEPT_NOTES: Record<ConceptId, string> = {
  'hero-spotlight': 'Estúdio escuro, uma fonte de luz, produto como sujeito único; tipografia expandida centralizada. Premium/marca.',
  'editorial-split': 'Grid assimétrico, coluna tipográfica alinhada à esquerda, produto atravessando um campo de cor. Informativo/benefícios.',
  'bold-block': 'Blocos de cor, numeral de volume gigante, adesivo de CTA. Energia promocional sem preço.',
  'catalog-clean': 'Fundo branco, produto em primeiro plano, ritmo de especificações. Marketplace/catálogo.',
};
