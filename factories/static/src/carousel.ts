// Carousel engine + Stories piece. Pages share one continuous background strip (sliced per page) so the swipe reads
// as a single sequence, while each page has its own composition.
import {accent, base, esc, fit, logoEl, productEl, type Ctx} from './templates.ts';

export type Page =
  | {kind: 'hook'; eyebrow: string; headline: string; footer: string}
  | {kind: 'problem'; headline: string; body: string}
  | {kind: 'solution'; eyebrow: string; headline: string; band: string}
  | {kind: 'steps'; headline: string; steps: {icon: 'machine' | 'hand'; title: string; text: string}[]}
  | {kind: 'cta'; headline: string; benefits: {icon: string; text: string}[]; cta: string; note: string};

export type Structure = 'hook-problem-explain-solution-cta' | 'educational-story' | 'step-by-step' | 'benefits' | 'tips' | 'comparison';
export const STRUCTURES: Record<Structure, string> = {
  'hook-problem-explain-solution-cta': 'Hook → problema → explicação → solução → CTA',
  'educational-story': 'Storytelling educativo',
  'step-by-step': 'Guia passo a passo',
  benefits: 'Benefícios do produto',
  tips: 'Dicas e curiosidades (exige fontes por dica)',
  comparison: 'Comparativo (exige prova; bloqueado sem evidência)',
};

const MACHINE = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="4" width="48" height="56" rx="8" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="32" cy="36" r="15" fill="none" stroke="currentColor" stroke-width="4"/><path d="M19 38c5-4 9 2 13-1s8-4 13 0" fill="none" stroke="currentColor" stroke-width="3"/><circle cx="17" cy="13" r="2.5" fill="currentColor"/></svg>`;
const HAND = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 30h48l-6 26H14z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/><path d="M12 38c6-4 12 3 20 0s14-4 20 0" fill="none" stroke="currentColor" stroke-width="3"/><path d="M32 6c5 7 7 10 7 13a7 7 0 0 1-14 0c0-3 2-6 7-13z" fill="currentColor"/></svg>`;

// One SVG drawn across N pages; each page shows its slice (left offset), giving seamless continuity.
function strip(n: number, w: number, h: number, u: number, offset: number) {
  const W = n * w;
  let wave = `M 0 ${h * 0.86}`, gold = `M 0 ${h * 0.8}`;
  for (let x = 0; x <= W; x += 40) {
    wave += ` L ${x} ${h * 0.86 + Math.sin(x / 260) * 34 * u + Math.sin(x / 97) * 10 * u}`;
    gold += ` L ${x} ${h * 0.8 + Math.sin(x / 260 + 0.9) * 40 * u}`;
  }
  wave += ` L ${W} ${h} L 0 ${h} Z`;
  return `<svg class="strip" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" style="position:absolute;left:${-offset}px;top:0" aria-hidden="true">
    <defs><linearGradient id="liq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d6dff" stop-opacity=".9"/><stop offset="1" stop-color="#04124a"/></linearGradient></defs>
    <path d="${wave}" fill="url(#liq)"/><path d="${gold}" fill="none" stroke="#e0ad45" stroke-width="${4 * u}" stroke-linecap="round"/></svg>`;
}

export function carouselPages(ctx: Ctx, pages: Page[]) {
  const {w, h, safe} = ctx.fmt, u = Math.min(w, h) / 1080, n = pages.length, t = ctx.kit.palette.tokens;
  return pages.map((p, i) => {
    const counter = `<div class="abs label counter" data-qc="text" data-fg="${i % 2 ? t.navy : '#ffffff'}" data-bg="${i % 2 ? t.mist : t.navy}">${String(i + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}</div>`;
    const bgs = ['#04124a', t.mist, 'linear-gradient(165deg,#1d6dff,#0a3fc2 45%,#04124a)', '#ffffff', '#04124a'];
    const dark = [true, false, true, false, true][i]!;
    const ink = dark ? '#ffffff' : t.navy, bgTok = dark ? t.navy : (i === 3 ? '#ffffff' : t.mist);
    let body = '';
    if (p.kind === 'hook') body = `
      <div class="abs label eyebrow" data-qc="text" data-fg="${t.gold}" data-bg="${t.navy}">${esc(p.eyebrow)}</div>
      <h1 class="abs display big" data-qc="text" data-fg="#ffffff" data-bg="${t.navy}">${accent(p.headline)}</h1>
      <div class="abs label swipe" data-qc="text" data-fg="#cfe0ff" data-bg="${t.navy}">${esc(p.footer)} <span aria-hidden="true">→</span></div>
      ${logoEl(ctx, safe.left, safe.top, 64 * u)}`;
    if (p.kind === 'problem') body = `
      <h1 class="abs headline mid" data-qc="text" data-fg="${t.navy}" data-bg="${t.mist}">${accent(p.headline)}</h1>
      <p class="abs body para" data-qc="text" data-fg="${t.ink}" data-bg="${t.mist}">${esc(p.body)}</p>
      <svg class="abs again" viewBox="-120 -120 240 240" aria-hidden="true"><path d="M 0 -92 A 92 92 0 1 1 -90 -18" fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round"/><path d="M -122 -32 L -88 6 L -58 -38 Z" fill="currentColor"/></svg>`;
    if (p.kind === 'solution') body = `
      <div class="abs label eyebrow e3" data-qc="text" data-fg="#ffffff" data-bg="${t.navy}">${esc(p.eyebrow)}</div>
      ${productEl(ctx, {jugH: Math.round(560 * u), cx: w * 0.5, baseY: h * 0.62, reflection: 0, shadow: 0.7})}
      <h2 class="abs headline sol" data-qc="text" data-fg="#ffffff" data-bg="${t.navy}">${accent(p.headline)}</h2>
`;
    if (p.kind === 'steps') body = `
      <h1 class="abs display mid" data-qc="text" data-fg="${t.navy}" data-bg="#ffffff">${accent(p.headline)}</h1>
      <div class="abs steps">${p.steps.map((s) => `<div class="step"><div class="ico">${s.icon === 'machine' ? MACHINE : HAND}</div><div><div class="headline st" data-qc="text" data-fg="${t.navy}" data-bg="${t.mist}">${esc(s.title)}</div><div class="body sx" data-qc="text" data-fg="${t.ink}" data-bg="${t.mist}">${esc(s.text)}</div></div></div>`).join('')}</div>`;
    if (p.kind === 'cta') body = `
      <h1 class="abs headline mid" data-qc="text" data-fg="#ffffff" data-bg="${t.navy}">${accent(p.headline)}</h1>
      <div class="abs list">${p.benefits.map((b) => `<div class="row body" data-qc="text" data-fg="#ffffff" data-bg="${t.navy}"><img src="${ctx.files[b.icon]}" alt="">${esc(b.text)}</div>`).join('')}</div>
      ${productEl(ctx, {jugH: Math.round(430 * u), cx: w - safe.right - 150 * u, baseY: h * 0.74, reflection: 0, shadow: 0.7, rot: 4})}
      <div class="abs ctawrap"><span class="pill headline cta" data-qc="cta" data-fg="${t.navy}" data-bg="${t.gold}">${esc(p.cta)} <span aria-hidden="true">→</span></span></div>
      <div class="abs label note" data-qc="text" data-fg="#cfe0ff" data-bg="${t.navy}">${esc(p.note)}</div>
      ${logoEl(ctx, safe.left, safe.top, 64 * u)}`;
    const css = `
.bg{position:absolute;inset:0;background:${bgs[i]}}
.counter{right:${safe.right}px;top:${safe.top + 14 * u}px;font-size:${20 * u}px;color:${ink}}
.eyebrow{left:${safe.left}px;top:${safe.top + 110 * u}px;font-size:${22 * u}px;color:var(--gold)}
.e3{left:50%;transform:translateX(-50%);white-space:nowrap;color:#fff;background:var(--navy);padding:${8 * u}px ${18 * u}px;border-radius:999px}
.big{left:${safe.left}px;right:${safe.right + 40 * u}px;top:${safe.top + 160 * u}px;font-size:${104 * u}px;color:#fff}
.swipe{left:${safe.left}px;top:${h * 0.68}px;font-size:${22 * u}px;color:#cfe0ff}
.mid{left:${safe.left}px;right:${safe.right}px;top:${safe.top + 110 * u}px;font-size:${78 * u}px;color:${ink}}
.mid .acc{color:${dark ? 'var(--gold)' : 'var(--royal)'}}
.para{left:${safe.left}px;width:${640 * u}px;top:${safe.top + 470 * u}px;font-size:${32 * u}px;color:var(--ink)}
.again{right:${safe.right + 20 * u}px;top:${safe.top + 560 * u}px;width:${380 * u}px;height:${380 * u}px;color:var(--royal);opacity:.16}
.sol{left:${safe.left}px;right:${safe.right}px;top:${h * 0.65}px;text-align:center;font-size:${50 * u}px;color:#fff;z-index:2}
.bandwrap{left:0;right:0;top:${safe.top + 160 * u}px;display:flex;justify-content:center;font-size:${24 * u}px}
.steps{left:${safe.left}px;right:${safe.right}px;top:${safe.top + 330 * u}px;display:flex;flex-direction:column;gap:${28 * u}px}
.step{display:flex;gap:${30 * u}px;align-items:center;background:var(--mist);border-radius:${28 * u}px;padding:${34 * u}px}
.ico{width:${110 * u}px;height:${110 * u}px;flex:none;color:var(--royal)}
.ico svg{width:100%;height:100%}
.st{font-size:${44 * u}px;color:var(--navy)}
.sx{font-size:${30 * u}px;color:var(--ink);margin-top:${6 * u}px}
.list{left:${safe.left}px;top:${safe.top + 380 * u}px;width:${560 * u}px;display:flex;flex-direction:column;gap:${18 * u}px}
.row{display:flex;align-items:center;gap:${18 * u}px;font-size:${28 * u}px;color:#fff}
.row img{width:${60 * u}px;height:${60 * u}px;border-radius:50%;flex:none}
.ctawrap{left:${safe.left}px;top:${h * 0.79}px;font-size:${32 * u}px}
.cta{background:var(--gold);color:var(--navy)}
.note{left:${safe.left}px;top:${h * 0.79 + 100 * u}px;font-size:${20 * u}px;color:#cfe0ff}`;
    return base(ctx, css, `<div class="bg"></div>${strip(n, w, h, u, i * w)}${counter}${body}`, `Carrossel ${i + 1}/${n}`);
  });
}

// ============ D — Stories promo (no price: price/offer UNKNOWN) ============
export function storyPromo(ctx: Ctx, c: {headline: string; sticker: string; chips: string[]; eyebrow: string}) {
  const {w, h, safe} = ctx.fmt, u = w / 1080, t = ctx.kit.palette.tokens;
  const contentBottom = h - safe.bottom; // 1248 on 1080×1920
  const css = `
.bg{position:absolute;inset:0;background:linear-gradient(170deg,#1d6dff 0%,#0a3fc2 38%,#04124a 78%)}
.glow{position:absolute;left:50%;top:${contentBottom - 380 * u}px;width:${900 * u}px;height:${500 * u}px;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(140,200,255,.45),transparent);filter:blur(10px)}
.eyebrow{left:${safe.left}px;top:${safe.top + 8 * u}px;font-size:${24 * u}px;color:var(--gold)}
.h1{left:${safe.left}px;right:${safe.right + 260 * u}px;top:${safe.top + 56 * u}px;font-size:${fit(c.headline, 96) * u}px;color:#fff}
.chips{left:${safe.left}px;top:${contentBottom - 470 * u}px;display:flex;flex-direction:column;gap:${14 * u}px;width:${470 * u}px}
.chip{display:inline-flex;align-self:flex-start;padding:${12 * u}px ${22 * u}px;border-radius:999px;background:rgba(4,18,74,.72);border:2px solid var(--gold);color:#fff;font-size:${24 * u}px}
.stickwrap{left:${safe.left + 30 * u}px;top:${contentBottom - 300 * u}px}
.sticker{width:${250 * u}px;height:${250 * u}px;border-radius:50%;background:var(--gold);color:var(--navy);display:grid;place-items:center;text-align:center;font-size:${34 * u}px;line-height:1.02;transform:rotate(-10deg);padding:${24 * u}px;box-shadow:0 ${16 * u}px ${36 * u}px rgba(0,0,30,.4)}`;
  const body = `<div class="bg"></div><div class="glow"></div>
  <div class="abs label eyebrow" data-qc="text" data-fg="${t.gold}" data-bg="${t.royal}">${esc(c.eyebrow)}</div>
  <h1 class="abs display h1" data-qc="text" data-fg="#ffffff" data-bg="${t.royal}">${accent(c.headline)}</h1>
  ${productEl(ctx, {jugH: Math.round(560 * u), cx: w * 0.72, baseY: contentBottom - 10 * u, reflection: 0, shadow: 0.75})}
  <div class="abs chips">${c.chips.map((x) => `<span class="chip label" data-qc="text" data-fg="#ffffff" data-bg="${t.navy}">${esc(x)}</span>`).join('')}</div>
  <div class="abs stickwrap"><div class="sticker headline" data-qc="cta" data-fg="${t.navy}" data-bg="${t.gold}">${esc(c.sticker)}</div></div>
  ${logoEl(ctx, w - safe.right - 72 * u * ctx.kit.logo.aspect_ratio, safe.top, 72 * u)}`;
  return base(ctx, css, body, plain(c.headline));
}
const plain = (s: string) => s.replace(/\*/g, '');
