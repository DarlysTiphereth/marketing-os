// Static Creative Factory orchestrator.  node src/produce.ts --brief briefs/grand-sabao-5l.brief.json
import {copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync, appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {FACTORY, FORMATS, REPO, enumerate, loadKit, loadProduct, resolveAsset, selectDiverse, validateCopy, type Combo, type CopyItem} from './core.ts';
import {CONCEPTS, CONCEPT_NOTES, photoComposite, type ConceptId, type Copy, type Ctx} from './templates.ts';
import {carouselPages, storyPromo, type Page} from './carousel.ts';
import {dhash, exportFormats, hamming, openChrome, pdfFromImages, qcPiece, renderPiece, sheet, type Check} from './render.ts';
import {ensureLayout, managed} from '../../../ops/config.ts';
import {Cas} from '../../../ops/storage/cas.ts';

const {values: a} = parseArgs({options: {brief: {type: 'string', default: 'briefs/grand-sabao-5l.brief.json'}, 'runs-dir': {type: 'string'}}});
const t0 = performance.now();
const briefRaw = readFileSync(path.resolve(FACTORY, a.brief!));
const brief = JSON.parse(briefRaw.toString('utf8'));
const kit = loadKit(brief.brand), product = loadProduct(brief.brand, brief.product);
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}_${createHash('sha256').update(briefRaw).digest('hex').slice(0, 10)}`;
const runDir = a['runs-dir'] ? path.resolve(a['runs-dir'], runId) : path.join(FACTORY, 'runs', runId);
const outDir = path.join(runDir, 'final'), srcDir = path.join(runDir, 'source');
for (const d of [outDir, srcDir]) mkdirSync(d, {recursive: true});
const log = (stage: string, msg: string, extra: Record<string, unknown> = {}) => { appendFileSync(path.join(runDir, 'run.log'), JSON.stringify({t: new Date().toISOString(), stage, msg, ...extra}) + '\n'); console.log(`[${stage}] ${msg}`); };
ensureLayout();
const work = managed('tmp', `static-${runId}`);
mkdirSync(work, {recursive: true});

// 1. Claims: every text must reference known claims (no source → no claim).
const copyItems: CopyItem[] = [...brief.headlines, ...brief.ctas, brief.band, ...brief.benefits,
  ...brief.carousel.pages.map((p: {kind: string; claim_refs: string[]}, i: number) => ({id: `carousel-${i + 1}`, text: p.kind, claim_refs: p.claim_refs})),
  {id: 'story', text: 'story', claim_refs: brief.story.claim_refs}];
const claims = validateCopy(copyItems, product);
if (!claims.ok) throw new Error(`claim validation failed: ${claims.errors.join('; ')}`);
log('claims', `${copyItems.length} copy items validated`, {pending_approval: claims.pending});

// 2. Assets: private brand files verified by sha256, staged next to the HTML (fonts are OFL, bundled).
const cas = new Cas();
const files: Record<string, string> = {};
for (const key of ['packshot', 'logo', 'icon_shirt', 'icon_leaf', 'icon_sparkle']) {
  const src = resolveAsset(product, key);
  const ref = cas.put(src, {name: `${brief.brand}/${brief.product}/${key}`, class: 'cache', run_id: runId});
  const name = `${key}${path.extname(src)}`;
  cas.materialize(ref.sha256, path.join(work, name));
  files[key] = name;
}
const font = path.join(FACTORY, 'node_modules/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2');
copyFileSync(font, path.join(work, 'archivo.woff2'));
files.font = 'archivo.woff2';

const ctxFor = (fmtId: string): Ctx => ({kit, fmt: FORMATS[fmtId]!, files, display: brief.display});
const H = Object.fromEntries(brief.headlines.map((h: CopyItem) => [h.id, h.text]));
const C = Object.fromEntries(brief.ctas.map((c: CopyItem) => [c.id, c.text]));
// The band never repeats a claim already made by the headline: it takes the first benefit with new claims.
const bandFor = (headlineId: string) => {
  const used = new Set(brief.headlines.find((h: CopyItem) => h.id === headlineId).claim_refs);
  if (!brief.band.claim_refs.some((r: string) => used.has(r))) return brief.band.text;
  return brief.benefits.find((b: CopyItem) => !b.claim_refs.some((r) => used.has(r)))?.text ?? undefined;
};
const copyFor = (cb: Combo): Copy => ({headline: H[cb.headline]!, cta: C[cb.cta]!, band: bandFor(cb.headline), eyebrow: brief.display.product, benefits: brief.benefits.map((b: {icon: string; text: string}) => ({icon: b.icon, text: b.text}))});

// 3. Variant space and diverse selection (do NOT render everything).
const space = brief.variant_space;
const all = enumerate({concept: space.concepts, headline: space.headlines, cta: space.ctas, format: space.formats});
const approved = (ids: string[]) => ids.every((r) => product.claims.find((c) => c.claim_id === r)?.approval === 'USER_APPROVED');
const fit: Record<string, Record<string, number>> = {'hero-spotlight': {feed_4x5: 3, square: 2, story: 2}, 'editorial-split': {feed_4x5: 3, square: 2, story: 1}, 'bold-block': {feed_4x5: 2, square: 2, story: 3}, 'catalog-clean': {feed_4x5: 1, square: 3, story: 0}};
const score = (cb: Combo) => (fit[cb.concept]?.[cb.format] ?? 0) * 2
  + (approved(brief.headlines.find((h: CopyItem) => h.id === cb.headline).claim_refs) ? 3 : 0)
  + (approved(brief.ctas.find((c: CopyItem) => c.id === cb.cta).claim_refs) ? 1 : 0);
const selected = selectDiverse(all, space.render_budget, score);
const best = selected[0]!;
log('variants', `${all.length} combinations, ${selected.length} selected for render`, {best});

type Piece = {id: string; group: string; fmt: string; html: string; concept?: string; combo?: Combo; allowTextOnProduct?: boolean; synthetic?: boolean};
const pieces: Piece[] = [];
pieces.push({id: 'A-photo-composite', group: 'A', fmt: 'feed_4x5', html: photoComposite(ctxFor('feed_4x5')), synthetic: true});
pieces.push({id: 'A2-marketplace-main', group: 'A', fmt: 'marketplace', html: CONCEPTS['catalog-clean'](ctxFor('marketplace'), copyFor(best)), concept: 'catalog-clean', synthetic: true});
pieces.push({id: `B-best-${best.concept}-${best.headline}-${best.cta}-${best.format}`, group: 'B', fmt: best.format, html: CONCEPTS[best.concept as ConceptId](ctxFor(best.format), copyFor(best)), concept: best.concept, combo: best});
for (const concept of space.concepts.filter((c: string) => c !== best.concept)) {
  const cb = {...best, concept};
  pieces.push({id: `E-variation-${concept}`, group: 'E', fmt: cb.format, html: CONCEPTS[concept as ConceptId](ctxFor(cb.format), copyFor(cb)), concept, combo: cb});
}
for (const cb of selected.slice(1)) {
  if (cb.headline === best.headline && cb.cta === best.cta && cb.format === best.format) continue; // already rendered as E
  pieces.push({id: `V-${cb.concept}-${cb.headline}-${cb.cta}-${cb.format}`, group: 'V', fmt: cb.format, html: CONCEPTS[cb.concept as ConceptId](ctxFor(cb.format), copyFor(cb)), concept: cb.concept, combo: cb});
}
const pages = carouselPages(ctxFor(brief.carousel.format), brief.carousel.pages as Page[]);
pages.forEach((html, i) => pieces.push({id: `C-carousel-${String(i + 1).padStart(2, '0')}`, group: 'C', fmt: brief.carousel.format, html}));
pieces.push({id: 'D-story-promo', group: 'D', fmt: 'story', html: storyPromo(ctxFor('story'), brief.story)});

// 4. Render + QC + export.
const browser = await openChrome();
const results: {id: string; group: string; fmt: string; concept?: string; combo?: Combo; checks: Check[]; verdict: string; outputs: Record<string, string | null>; sha256: string; bytes: number; synthetic: boolean}[] = [];
const hashes: {id: string; concept?: string; group: string; h: bigint}[] = [];
try {
  for (const p of pieces) {
    const r = await renderPiece(browser, p.html, FORMATS[p.fmt]!, work, p.id);
    const checks = qcPiece(r, FORMATS[p.fmt]!, {allowTextOnProduct: p.allowTextOnProduct ?? false});
    const verdict = checks.some((c) => c.status === 'FAIL') ? 'FAIL' : checks.some((c) => c.status === 'WARN') ? 'PASS_WITH_WARNINGS' : 'PASS';
    const out = exportFormats(r.png, path.join(outDir, p.id));
    const stored = cas.put(out.png, {name: `${brief.brief_id}/${p.id}.png`, class: 'candidate', run_id: runId});
    // Editable source: the exact HTML + parameters; private assets are referenced by name, never bundled into Git.
    copyFileSync(r.htmlFile, path.join(srcDir, `${p.id}.html`));
    hashes.push({id: p.id, group: p.group, h: dhash(r.png), ...(p.concept ? {concept: p.concept} : {})});
    results.push({id: p.id, group: p.group, fmt: p.fmt, ...(p.concept ? {concept: p.concept} : {}), ...(p.combo ? {combo: p.combo} : {}), checks, verdict, outputs: out, sha256: stored.sha256, bytes: statSync(out.png).size, synthetic: p.synthetic ?? false});
    log('render', `${p.id} ${verdict}`, {fails: checks.filter((c) => c.status !== 'PASS').map((c) => `${c.id}:${c.status}`)});
  }
  const carouselPngs = results.filter((r) => r.group === 'C').map((r) => r.outputs.png!);
  await pdfFromImages(browser, carouselPngs, FORMATS[brief.carousel.format]!, path.join(outDir, 'C-carousel.pdf'), work);
} finally {
  await browser.close();
}

// 5. Repetitive layout check across different concepts / carousel pages.
const repeats: string[] = [];
for (let i = 0; i < hashes.length; i++) for (let j = i + 1; j < hashes.length; j++) {
  const x = hashes[i]!, y = hashes[j]!;
  const comparable = (x.group === 'C' && y.group === 'C') || (x.concept && y.concept && x.concept !== y.concept);
  if (comparable && hamming(x.h, y.h) < 10) repeats.push(`${x.id} ≈ ${y.id} (dHash ${hamming(x.h, y.h)}/64)`);
}
log('qc', `repetitive layouts: ${repeats.length}`, {repeats});

// 6. Package: contact sheet, gallery, manifests. Source files copied for editing; fonts copied (OFL).
const sheetFile = sheet(results.map((r) => r.outputs.png!), path.join(runDir, 'contact-sheet.jpg'));
cpSync(path.join(work, 'archivo.woff2'), path.join(srcDir, 'archivo.woff2'));
writeFileSync(path.join(srcDir, 'README.md'), `Editable sources. Open any .html in Chrome with the brand assets (${Object.keys(files).filter((k) => k !== 'font').join(', ')}) placed next to it; parameters in ../manifest.json. Brand assets are private and are not included.\n`);
const gallery = `<!doctype html><meta charset="utf-8"><title>${brief.brief_id}</title><style>body{font-family:system-ui;margin:24px;background:#f3f5fa}h2{margin:28px 0 8px}div.g{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0;background:#fff;padding:8px;border-radius:8px}img{height:420px;display:block}figcaption{font:12px monospace;margin-top:6px;max-width:340px}</style>
${['A', 'B', 'C', 'D', 'E', 'V'].map((g) => `<h2>${g}</h2><div class="g">${results.filter((r) => r.group === g).map((r) => `<figure><img src="final/${r.id}.jpg"><figcaption>${r.id}<br>${r.verdict}</figcaption></figure>`).join('')}</div>`).join('')}`;
writeFileSync(path.join(runDir, 'index.html'), gallery);
const total = (performance.now() - t0) / 1000;
const manifest = {
  run_id: runId, brief: path.relative(REPO, path.resolve(FACTORY, a.brief!)).replaceAll('\\', '/'), brief_sha256: createHash('sha256').update(briefRaw).digest('hex'),
  brand_kit: 'factories/shared/brand-kits/grand/kit.json', product: `factories/shared/products/${brief.brand}/${brief.product}.json`,
  renderer: 'playwright-core 1.56.1 + chrome-headless-shell (existing install) · ffmpeg for JPG/WebP · Chrome print-to-PDF', fonts: 'Archivo Variable (OFL-1.1)',
  claims_pending_approval: claims.pending, labels: {synthetic_composites: results.filter((r) => r.synthetic).map((r) => r.id), statement: 'SYNTHETIC_COMPOSITE: digital composition using the real product photo; not a studio photograph.'},
  variant_space: {combinations: all.length, dims: {concepts: space.concepts.length, headlines: space.headlines.length, ctas: space.ctas.length, formats: space.formats.length}, selected, best, concept_notes: CONCEPT_NOTES},
  pieces: results.map(({checks: _c, ...r}) => r), repeats, contact_sheet: sheetFile ? 'contact-sheet.jpg' : null, gallery: 'index.html',
  timings_s: {total: +total.toFixed(2)}, cost: {api_usd: 0, paid_calls: 0}, review: 'PENDING_HUMAN_REVIEW (no piece is approved or published automatically)',
};
writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(path.join(runDir, 'qc.json'), JSON.stringify({pieces: results.map((r) => ({id: r.id, verdict: r.verdict, checks: r.checks})), repeats}, null, 2) + '\n');
writeFileSync(path.join(runDir, 'variants.json'), JSON.stringify(all.map((cb) => ({...cb, score: score(cb), selected: selected.includes(cb)})), null, 2) + '\n');
rmSync(work, {recursive: true, force: true});
log('done', `${results.length} pieces in ${total.toFixed(1)} s → ${runDir}`, {fails: results.filter((r) => r.verdict === 'FAIL').map((r) => r.id)});
writeFileSync(path.join(FACTORY, 'runs', 'LATEST'), runId + '\n');
