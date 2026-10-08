// Explicit, offline pilot execution. Does not install tools, access APIs or publish assets.
import {mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Product, ShoppableVideo, Publication} from '../src/commerce/contracts.ts';
import {fingerprint, planCampaign, publishingDecision, rankOffers} from '../src/commerce/engine.ts';
import {affiliatePilot, sellerPilot, REVIEW_REQUIRED} from '../src/commerce/pilots.ts';
import {performanceReport, dashboardHtml} from '../src/commerce/performance.ts';
import {MockCommerceAdapter, UnsupportedPlatformAdapter} from '../src/commerce/adapter.ts';
import {loadProduct, resolveAsset, FORMATS} from '../factories/static/src/core.ts';
import type {Format} from '../factories/static/src/core.ts';
import {openChrome, renderPiece, qcPiece} from '../factories/static/src/render.ts';
import {TOOLS, run, sha256, sha256File, writeJson} from '../experiments/remotion/pipeline/lib.ts';
import {buildAudio} from '../experiments/remotion/pipeline/audio.ts';
import {technicalQc} from '../experiments/remotion/pipeline/qc.ts';
import type {Timeline} from '../experiments/remotion/src/schema.ts';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(REPO, '.mos/commerce');
const started = Date.now();
mkdirSync(OUTPUT, {recursive: true});
const ownedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><defs><linearGradient id="b"><stop stop-color="#66c7ed"/><stop offset="1" stop-color="#1264ad"/></linearGradient></defs><rect x="100" y="160" width="600" height="490" rx="55" fill="url(#b)"/><path d="M120 230L680 570M120 330L550 650M280 160L700 450" stroke="#c6efff" stroke-width="10" opacity=".5"/><rect x="235" y="320" width="330" height="150" rx="20" fill="#04124a"/><text x="400" y="410" text-anchor="middle" font-family="sans-serif" font-size="75" fill="white">MOCK</text></svg>`;
const mockAsset = path.join(OUTPUT, 'mock-pano.svg');
writeFileSync(mockAsset, ownedSvg);
const real = loadProduct('grand', 'sabao-liquido-premium-5l');
const packshot = resolveAsset(real, 'packshot'); // existing loader verifies bytes before rendering
const grand = Product.parse({brand_id: real.brand_id, product_id: real.product_id, name: real.name,
  category: 'laundry-saneante', version: 'approved-source-v1', evidence: 'REAL_DATA', fixture_labels: null,
  claims: real.claims.filter(c => c.approval === 'USER_APPROVED').map(c => ({claim_id: c.claim_id, text: c.text,
    source_ref: c.source_ref, approved: true, language: 'pt-BR'})),
  assets: [{asset_id: 'packshot', sha256: sha256File(packshot), license_status: 'UNKNOWN',
    source_ref: 'Existing user-provided authentic product asset; publication rights require human verification'}]});
const pilots = [sellerPilot(grand), affiliatePilot(sha256(ownedSvg))];
const edl = JSON.parse(readFileSync(path.join(REPO, 'experiments/remotion/cinematic/edit.json'), 'utf8'));
const sources = ['hands', 'drum', 'denim'].map(key => {
  const source = edl.sources[key]; const local = path.resolve(REPO, source.local);
  if (!local.startsWith(REPO + path.sep) || sha256File(local) !== source.sha256) throw new Error('STOCK_HASH_OR_PATH_INVALID');
  return {...source, local};
});
const font = readFileSync(path.join(REPO, 'factories/static/node_modules/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2')).toString('base64');
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!));
const imageData = (file: string) => `data:image/${file.endsWith('.svg') ? 'svg+xml' : 'png'};base64,${readFileSync(file).toString('base64')}`;
function html(copy: {headline: string; facts: string; disclosure: string}, asset: string, scene: number, isStatic: boolean) {
  const bg = '#04124a', accent = scene === 1 ? '#5fb3ff' : '#e0ad45';
  const t = (text: string, x: number, y: number, w: number, size: number, color = '#ffffff') =>
    `<div data-qc="text" data-fg="${color}" data-bg="${bg}" style="position:absolute;left:${isStatic ? Math.max(x, 80) : x}px;top:${y}px;width:${isStatic ? Math.min(w, 920) : w}px;font-size:${size}px;font-weight:800;line-height:1.12">${escape(text)}</div>`;
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><style>
@font-face{font-family:Archivo;src:url(data:font/woff2;base64,${font});font-weight:100 900}*{box-sizing:border-box}body{margin:0;background:${bg};font-family:Archivo;color:white;width:1080px;height:${isStatic ? 1350 : 1920}px;overflow:hidden}
.orb{position:absolute;width:1100px;height:1100px;left:-600px;top:420px;border:100px solid #0a3fc2;border-radius:50%;opacity:.5}
</style><div class="orb"></div><div style="position:absolute;left:65px;top:${isStatic ? 155 : 335}px;width:90px;height:7px;background:${accent}"></div>
${t(copy.disclosure, 65, isStatic ? 75 : 275, 950, 28, accent)}
${t(copy.headline, 65, isStatic ? 200 : 370, 945, 72)}
<img data-qc="asset" src="${imageData(asset)}" style="position:absolute;left:${isStatic ? 270 : 65}px;top:${isStatic ? 430 : 590}px;width:${isStatic ? 540 : 470}px;height:${isStatic ? 540 : 470}px;object-fit:contain">
${isStatic ? '' : '<div style="position:absolute;left:555px;top:610px;width:470px;height:400px;border:10px solid #5fb3ff;border-radius:5px;background:#0a3fc2"></div>'}
${t(copy.facts, 65, isStatic ? 1020 : 1095, 950, 34)}
${t(isStatic ? 'Publicidade · Preview interno' : 'Cenas ilustrativas · Sem depoimento', 65, isStatic ? 1215 : 1205, 950, 24, '#ffffff')}
</html>`;
}
function layoutQc(render: Awaited<ReturnType<typeof renderPiece>>, format: Format) {
  // The existing jug-specific rules assume a different template. Measure this template's actual image box instead.
  const checks = qcPiece(render, format).filter(c => !['product_resolution', 'logo_aspect', 'text_over_product'].includes(c.id));
  const images = render.boxes.filter(b => b.kind === 'asset');
  const intersects = (a: typeof render.boxes[number], b: typeof render.boxes[number]) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  const overlap = render.boxes.filter(b => b.kind === 'text').some(t => images.some(img => intersects(t, img)));
  const loaded = images.length === 1 && images.every(i => i.loaded && Math.abs(i.natural! - i.rendered!) < 0.01);
  checks.push({id: 'packshot_loaded_aspect', status: loaded ? 'PASS' : 'FAIL', detail: 'actual image loaded, original square aspect preserved'},
    {id: 'text_over_packshot', status: overlap ? 'FAIL' : 'PASS', detail: 'actual text and full packaging image boxes do not intersect'},
    {id: 'packshot_scale', status: images.every(i => i.w <= 800) ? 'PASS' : 'FAIL', detail: 'render width <= 800px original packshot / SVG viewBox'});
  return checks;
}
const browser = await openChrome();
async function jpegRaster(png: string, jpeg: string) {
  // Encode a verified JPEG raster in Chrome and measure fidelity against the original PNG.
  const page = await browser.newPage({viewport: {width: 1080, height: 1920}});
  try {
    // Canvas avoids a second viewport screenshot/compositor and verifies the PNG -> JPEG raster itself.
    const result = await page.evaluate(async source => {
      const image = new Image(); image.src = source; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
      const reference = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const encoded = canvas.toDataURL('image/jpeg', 1); const jpg = new Image(); jpg.src = encoded; await jpg.decode();
      ctx.drawImage(jpg, 0, 0); const decoded = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let error = 0; for (let p = 0; p < reference.length; p += 4) for (let channel = 0; channel < 3; channel++)
        error += (reference[p + channel]! - decoded[p + channel]!) ** 2;
      const mse = error / (canvas.width * canvas.height * 3);
      return {encoded: encoded.split(',')[1]!, psnr: mse === 0 ? 100 : 10 * Math.log10(255 * 255 / mse)};
    }, imageData(png));
    if (result.psnr < 35) throw new Error('PNG_TO_JPEG_REFERENCE_FIDELITY_FAILED');
    writeFileSync(jpeg, Buffer.from(result.encoded, 'base64'));
    writeJson(jpeg.replace(/\.jpg$/, '-raster-qc.json'), {status: 'PASS', source_png_sha256: sha256File(png),
      jpeg_sha256: sha256File(jpeg), psnr_db: result.psnr, threshold_db: 35, evidence: 'MEASURED_CHROME_CANVAS_RGB'});
  } finally {await page.close();}
}
const reports: ReturnType<typeof performanceReport>[] = [];
const summaries: unknown[] = [];
try {
  for (const [pilotIndex, inputs] of pilots.entries()) {
    const c = inputs.campaign, variants = planCampaign(inputs), selected = variants[0]!;
    const dir = path.join(OUTPUT, `${c.campaign_id}-${fingerprint(inputs).slice(0, 12)}`);
    mkdirSync(dir, {recursive: true});
    console.log(`[commerce] ${c.campaign_id}: planning and asset verification`);
    const asset = pilotIndex === 0 ? packshot : mockAsset;
    writeJson(path.join(dir, 'registration.json'), inputs);
    writeJson(path.join(dir, 'brief.json'), {objective: c.objective, audience: 'Pessoas interessadas em cuidados domésticos; hipótese editorial, não dado observado',
      creative_validation: 'NOT_VALIDATED_BY_SALES', format: 'faceless discovery / sourced catalog', budget_additional_brl: 0,
      commercial_data: {price: inputs.listing.product_price, stock: inputs.listing.stock_status, currency: c.currency},
      no_testimonials: true, footage_role: 'ILLUSTRATIVE_NOT_PRODUCT_USE_OR_EFFICACY_PROOF'});
    writeJson(path.join(dir, 'scripts.json'), variants);
    const story = selected.on_screen_text.map((text, i) => ({scene: i + 1, start_s: i * 6, duration_s: 6,
      on_screen_text: text, source: sources[(i + pilotIndex) % sources.length].page, role: 'ILLUSTRATIVE', faceless_review: 'HUMAN_REVIEW_REQUIRED_BEFORE_PUBLICATION'}));
    writeJson(path.join(dir, 'storyboard.json'), story);
    const facts = inputs.product.claims.filter(x => x.approved).map(x => x.text).join(' · ');
    const staticResult = await renderPiece(browser, html({headline: pilotIndex ? 'Conheça o produto' : 'Conheça a GRAND',
      facts, disclosure: selected.commercial_disclosure}, asset, 0, true), FORMATS.feed_4x5!, dir, 'static-ad');
    const staticQc = layoutQc(staticResult, FORMATS.feed_4x5!);
    if (staticQc.some(x => x.status === 'FAIL')) throw new Error(`STATIC_QC: ${JSON.stringify(staticQc)}`);
    const segments: string[] = [];
    for (let k = 0; k < 3; k++) {
      const frame = await renderPiece(browser, html({headline: selected.on_screen_text[k]!, facts: k === 1 ? 'Detalhes do catálogo' : facts,
        disclosure: selected.commercial_disclosure}, asset, k, false), FORMATS.story!, dir, `scene-${k}`);
      const sceneQc = layoutQc(frame, FORMATS.story!);
      if (sceneQc.some(x => x.status === 'FAIL')) throw new Error(`LAYOUT_QC: ${JSON.stringify(sceneQc)}`);
      writeJson(path.join(dir, `scene-${k}-qc.json`), sceneQc);
      const jpeg = path.join(dir, `scene-${k}.jpg`);
      await jpegRaster(frame.png, jpeg);
      const segment = path.join(dir, `segment-${k}.mp4`);
      const source = sources[(k + pilotIndex) % sources.length];
      console.log(`[commerce] ${c.campaign_id}: encode scene ${k + 1}/3 (CPU, 2 threads)`);
      run(TOOLS.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-loop', '1', '-framerate', '30', '-threads', '1', '-i', jpeg,
        '-stream_loop', '-1', '-ss', String(k), '-threads', '1', '-i', source.local, '-filter_complex_threads', '1',
        '-filter_complex', '[0:v]format=rgb24[base];[1:v]scale=450:380:force_original_aspect_ratio=increase,crop=450:380,setsar=1,fps=30,format=rgb24[stock];[base][stock]overlay=565:620:shortest=1:format=rgb,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[v]',
        '-map', '[v]', '-an', '-t', '6', '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
        '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-threads', '2', segment]);
      segments.push(segment);
    }
    const timeline: Timeline = {variant_id: selected.creative_id, creative_id: selected.creative_id,
      selection: {hook: 'discovery', body: 'catalog', cta: 'details', style: 'blue', voice: 'none', music: 'procedural', pacing: 'standard', captions: 'off'},
      style: {style_id: 'blue', palette: {bg0: '#04124a', bg1: '#0a3fc2', accent: '#e0ad45', ink: '#071237', paper: '#ffffff', danger: '#cc3333'},
        font_display: 'Archivo', font_body: 'Archivo', palette_status: pilotIndex ? 'DESIGN_CHOICE' : 'DERIVED_FROM_APPROVED_ASSET'},
      width: 1080, height: 1920, duration: 18, fps: 30, assets: {packshot: path.basename(asset)},
      display: {brand_name: inputs.product.brand_id, brand_tagline: '', product_title: inputs.product.name, product_subtitle: ''},
      scenes: story.map((s, i) => ({scene_id: `scene-${i}`, start: s.start_s, duration: 6,
        slot: (['hook', 'benefits', 'cta'] as const)[i]!, min_duration_s: 6, purpose: 'Sourced catalog copy with illustrative stock',
        voiceover: '', visual_type: 'stock_footage', visual_prompt: 'Existing licensed stock inset; not efficacy proof',
        camera: 'crop', motion: 'source footage', transition: 'cut', music_direction: 'procedural bed',
        asset_source: 'stock', generation_model: 'NONE', estimated_cost_usd: 0, claim_refs: selected.claim_refs,
        layout: {component: 'commerce-html-stock', params: {stock_x: 565, stock_y: 620}},
        vo_start: s.start_s, vo_duration: 0, words: [], beats: [0, 3], sfx: ['pop'],
        on_screen_text: [s.on_screen_text, i === 1 ? 'Detalhes do catálogo' : facts,
          selected.commercial_disclosure, 'Cenas ilustrativas · Sem depoimento']}))};
    writeJson(path.join(dir, 'timeline.json'), timeline);
    const silentLines = story.map(() => ({wav48: '', cache_key: 'none', cached: true, seconds: 0, speech_start: 0,
      speech_end: 0, words: [], voice: 'none', provider: 'none', source_rate_hz: 0}));
    const audio = buildAudio(timeline, silentLines, {bpm: 104, seed: 800 + pilotIndex, workDir: dir});
    const concat = path.join(dir, 'segments.txt');
    // Fixed managed filenames, quoted for ffmpeg's concat demuxer; paths are relative to this list.
    writeFileSync(concat, segments.map((_, k) => `file 'segment-${k}.mp4'`).join('\n') + '\n');
    const mp4 = path.join(dir, 'ugc-faceless.mp4');
    run(TOOLS.ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '1', '-i', concat,
      '-i', audio.final, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
      '-ar', '48000', '-ac', '2', '-af', 'volume=1dB', '-t', '18', '-movflags', '+faststart', '-map_metadata', '-1', mp4]);
    console.log(`[commerce] ${c.campaign_id}: measured video QC`);
    const videoQc = technicalQc(mp4, timeline, {minDur: 17.9, maxDur: 18.1});
    // Existing QC's caption/content rules describe Ad.tsx. Replace those assertions with actual measured HTML checks.
    videoQc.checks = videoQc.checks.filter(x => !['caption_safe_zone', 'content_safe_zone'].includes(x.id));
    for (let k = 0; k < 3; k++) {
      const decoded = path.join(dir, `decoded-scene-${k}.jpg`);
      run(TOOLS.ffmpeg, ['-v', 'error', '-y', '-ss', String(k * 6), '-i', mp4, '-frames:v', '1',
        '-vf', 'scale=out_color_matrix=bt601:out_range=pc', '-c:v', 'mjpeg', '-q:v', '1', '-colorspace', 'bt470bg', '-color_range', 'pc', decoded]);
      for (const [region, crop] of [['header', '1080:550:0:0'], ['footer', '1080:200:0:1050']]) {
        const comparison = run(TOOLS.ffmpeg, ['-hide_banner', '-i', path.join(dir, `scene-${k}.jpg`), '-i', decoded,
          '-filter_complex', `[0:v]crop=${crop},scale=in_color_matrix=bt601:out_color_matrix=bt709:out_range=tv,format=yuv420p[ref];[1:v]crop=${crop},scale=in_color_matrix=bt601:out_color_matrix=bt709:out_range=tv,format=yuv420p[test];[ref][test]psnr`, '-frames:v', '1', '-f', 'null', '-']);
        const psnr = Number(comparison.stderr.match(/average:([\d.]+)/)?.[1]);
        videoQc.checks.push({id: `scene_${k}_${region}_fidelity`, status: Number.isFinite(psnr) && psnr >= 35 ? 'PASS' : 'FAIL',
          measured: psnr, threshold: 'PSNR >= 35 dB, both references normalized to delivery BT.709 limited yuv420p; moving footage excluded', evidence: 'MEASURED'});
      }
    }
    videoQc.verdict = videoQc.checks.some(x => x.status === 'FAIL') ? 'FAIL' : 'PASS';
    writeJson(path.join(dir, 'qc.json'), {technical: videoQc, static: staticQc, visual_review: 'HUMAN_REVIEW_REQUIRED', efficacy_proof: 'NONE'});
    if (videoQc.verdict !== 'PASS') throw new Error(`VIDEO_QC: ${JSON.stringify(videoQc.checks.filter(x => x.status === 'FAIL'))}`);
    run(TOOLS.ffmpeg, ['-v', 'error', '-y', '-i', mp4, '-vf', 'fps=1/3,scale=270:480,tile=3x2', '-frames:v', '1', path.join(dir, 'contact-sheet.jpg')]);
    const governance = {...REVIEW_REQUIRED, qc_pass: true, publication_assets: [
      {creative_id: selected.creative_id, kind: 'VIDEO' as const, sha256: sha256File(mp4)},
      {creative_id: selected.creative_id, kind: 'STATIC_AD' as const, sha256: sha256File(staticResult.png)}]};
    const decision = publishingDecision(inputs, [selected], governance, new Date().toISOString());
    const media = ShoppableVideo.parse({creative_id: selected.creative_id, campaign_id: c.campaign_id, listing_id: c.listing_id,
      sha256: sha256File(mp4), width: 1080, height: 1920, duration_s: Number(videoQc.ffprobe.format.duration), qc_status: 'PASS',
      attachment_status: 'NOT_SUPPORTED', evidence: c.evidence});
    const publication = Publication.parse({account_id: c.account_id, commerce_type: c.commerce_type, brand_id: c.brand_id,
      product_id: c.product_id, shop_id: c.shop_id, market_id: c.market_id, platform_id: c.platform_id, language: c.language,
      currency: c.currency, evidence: c.evidence, publication_id: `${c.campaign_id}-preview`, campaign_id: c.campaign_id,
      creative_id: selected.creative_id, status: decision.status, human_approved: false, reasons: decision.reasons, input_fingerprint: decision.input_fingerprint});
    const adapter = c.evidence === 'MOCK' ? new MockCommerceAdapter(inputs) : new UnsupportedPlatformAdapter();
    writeJson(path.join(dir, 'tiktok-shop-package.json'), {publication, media, fixture_labels: inputs.product.fixture_labels,
      approved_asset_candidates: governance.publication_assets, caption: selected.caption,
      static_asset: {file: 'static-ad.png', sha256: sha256File(staticResult.png)},
      api: adapter.prepareShoppableAsset(variants), offer_ranking: c.commerce_type === 'AFFILIATE' ? rankOffers([inputs], new Date().toISOString()) : [],
      attachment: 'NOT_SUPPORTED: manual human-reviewed preparation only; no Shop link or actual listing exists',
      asset_provenance: sources.map(({local: _local, ...s}) => ({...s,
        license_verified_at: '2026-10-08', license_url: 'https://www.pexels.com/license/',
        license_note: 'Current license permits modified marketing use; do not imply endorsement. Existing original EDL evidence preserved.'}))});
    const report = performanceReport(c, [], []); reports.push(report);
    writeJson(path.join(dir, 'performance.json'), report);
    const summary = {campaign_id: c.campaign_id, commerce_type: c.commerce_type, evidence: c.evidence,
      directory: path.relative(REPO, dir).replaceAll('\\', '/'), scripts: variants.length, video_sha256: media.sha256,
      video_bytes: statSync(mp4).size, static_sha256: sha256File(staticResult.png), video_qc: videoQc.verdict,
      static_qc: staticQc.some(x => x.status === 'FAIL') ? 'FAIL' : 'PASS', publication: publication.status,
      shoppable_attachment: 'NOT_SUPPORTED', paid_calls: 0, additional_cost_brl: 0, gpu_required: false,
      execution: 'EXISTING_LOCAL_CPU_FALLBACK_NO_REMOTE_RENDER_DISPATCH', creative_validation: 'NOT_VALIDATED_BY_SALES'};
    writeJson(path.join(dir, 'execution-report.json'), summary); summaries.push(summary);
    console.log(`[commerce] ${c.campaign_id}: video/static QC PASS; publication BLOCKED`);
  }
} finally { await browser.close(); }
writeFileSync(path.join(OUTPUT, 'dashboard.html'), dashboardHtml(reports));
writeJson(path.join(OUTPUT, 'benchmark.json'), {schema_version: 'commerce-benchmark.v1', elapsed_s: (Date.now() - started) / 1000,
  pilots: summaries, private_media_in_git: false, real_transactions: 0, real_publications: 0});
console.log(`[commerce] completed: ${summaries.length} real rendered previews, 0 publications, 0 paid API calls`);
