// Two review studies only. No providers, downloads, publishing, queue or mass-production entry point.
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {Asset, assetFirst, pendingGates, reviewFingerprint, sampleBatch, scaleDecision} from '../src/creative-quality/director.ts';
import {openChrome} from '../factories/static/src/render.ts';
import {TOOLS, run, sha256File, writeJson, writeWav16} from '../experiments/remotion/pipeline/lib.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.mos/creative-recovery');
const start = Date.now(); mkdirSync(OUT, {recursive: true});
const concepts = JSON.parse(readFileSync(path.join(ROOT, 'creative-quality/concepts.json'), 'utf8'));
const selected = sampleBatch(concepts.slice(0, 2));
const product = JSON.parse(readFileSync(path.join(ROOT, 'factories/shared/products/grand/sabao-liquido-premium-5l.json'), 'utf8'));
if(product.brand_id !== 'grand' || product.product_id !== 'sabao-liquido-premium-5l') throw new Error('PRODUCT_SCOPE_MISMATCH');
const edl = JSON.parse(readFileSync(path.join(ROOT, 'experiments/remotion/cinematic/edit.json'), 'utf8'));
const font = path.join(ROOT, 'factories/static/node_modules/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2');
const files = {packshot: path.join(ROOT, product.assets.packshot.local_path_hint), water: path.join(ROOT, edl.sources.water.local),
  denim: path.join(ROOT, edl.sources.denim.local), hands: path.join(ROOT, edl.sources.hands.local),
  'water-audio': path.join(OUT, 'assets/swim.wav'), archivo: font};
const expected = {packshot: product.assets.packshot.sha256, water: edl.sources.water.sha256,
  denim: edl.sources.denim.sha256, hands: edl.sources.hands.sha256,
  'water-audio': '9a968e9083ca7979b225838c218e59d9f4da7fa5ddbd20567cd4b45a3c8814f8',
  archivo: '8f704806dbedeaaeca334b11ec348bc3ac3a439d6431544b3afb54f534ee4967'};
const inventory = Object.entries(files).map(([id, f]) => Asset.parse({id, kind: id === 'packshot' ? 'PACKSHOT' :
  id === 'water-audio' ? 'AUDIO' : id === 'archivo' ? 'FONT' : 'CATEGORY_FOOTAGE',
  sha256: existsSync(f) ? sha256File(f) : '0'.repeat(64), available: existsSync(f),
  verified_bytes: existsSync(f) && sha256File(f) === expected[id],
  source: id === 'packshot' ? 'Existing authentic user asset; internal study only' : id === 'archivo' ? 'Archivo / installed Fontsource / OFL' :
    id === 'water-audio' ? 'https://opengameart.org/content/skippy-fish-water-sound-collection' : edl.sources[id].page,
  rights: id === 'packshot' ? 'INTERNAL_USER_ASSET' : id === 'archivo' ? 'OFL' : id === 'water-audio' ? 'CC0' : 'PEXELS',
  width: id === 'packshot' ? 800 : id === 'archivo' || id === 'water-audio' ? null : 1080,
  height: id === 'packshot' ? 800 : id === 'archivo' || id === 'water-audio' ? null : 1920,
  product_id: id === 'packshot' ? product.product_id : null}));
for (const c of selected) {
  const gate = assetFirst(c, inventory);
  if (gate.status === 'BLOCKED') throw new Error(`ASSET_FIRST:${gate.reasons.join(',')}`);
  if (c.scope === 'PRODUCT_STUDY') {
    const proof = product.claims.find(x => c.proven_benefit.source.endsWith('#' + x.claim_id));
    if (!proof || proof.approval !== 'USER_APPROVED' || proof.text !== c.proven_benefit.text) throw new Error('UNAPPROVED_BENEFIT');
    if(!product.claims.some(x => x.approval === 'USER_APPROVED' && x.text === c.cta)) throw new Error('UNAPPROVED_CTA');
  }
}
writeJson(path.join(OUT, 'asset-inventory.json'), inventory);
writeJson(path.join(OUT, 'concept-preflight.json'), concepts.map(c => ({id: c.id, ...assetFirst(c, inventory)})));
const browser = await openChrome();
const versions = {node:process.version, chrome:browser.version(), ffmpeg:run(TOOLS.ffmpeg,['-version']).stdout.split('\n')[0],
  renderer_sha256:sha256File(fileURLToPath(import.meta.url))};
const dataImage = f => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
const esc = s => s.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const fontData = readFileSync(font).toString('base64');
const base = body => `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:A;src:url(data:font/woff2;base64,${fontData});font-weight:100 900}*{box-sizing:border-box}body{margin:0;width:1080px;height:1920px;background:transparent;font-family:A;color:white} .text{position:absolute;line-height:1.08;text-shadow:0 2px 12px #0008} .label{font-size:25px;letter-spacing:4px;font-weight:600}.fine{font-size:23px;font-weight:500;letter-spacing:.5px}</style>${body}`;
async function overlay(id, body) {
  const page = await browser.newPage({viewport: {width: 1080, height: 1920}, deviceScaleFactor: 1});
  try {
    await page.setContent(base(body)); await page.evaluate(() => document.fonts.ready);
    await page.evaluate(async () => {await Promise.all([...document.images].map(i => i.decode()));});
    const boxes = await page.evaluate(() => [...document.querySelectorAll('.text')].map(el => {
      const r = el.getBoundingClientRect(); return {text: el.textContent, x: r.x, y: r.y, w: r.width, h: r.height};}));
    if (boxes.some(b => b.x < 60 || b.x + b.w > 1020 || b.y < 230 || b.y + b.h > 1600)) throw new Error('MEASURED_LAYOUT_OUTSIDE_SAFE_ZONE');
    const output = path.join(OUT, id + '.png');
    await page.screenshot({path: output, omitBackground: true});
    writeJson(path.join(OUT, id + '-layout.json'), boxes);
    return output;
  } finally {await page.close();}
}
const title = (copy, y, size = 78, color = 'white') => `<div class="text" style="left:78px;top:${y}px;max-width:880px;font-size:${size}px;font-weight:700;color:${color}">${copy}</div>`;
const note = (copy, y = 1520) => `<div class="text fine" style="left:78px;top:${y}px;max-width:900px">${copy}</div>`;
const hero = `<div style="position:absolute;left:377px;top:1290px;width:340px;height:42px;background:#020a24;filter:blur(22px);border-radius:50%;opacity:.55"></div><img src="${dataImage(files.packshot)}" style="position:absolute;left:140px;top:565px;width:800px;height:800px;object-fit:contain;filter:drop-shadow(14px 12px 22px #04102088)">`;
const phaseA = [
  {src: 'water', at: .3, dur: 2.2, grade: 'eq=brightness=-0.11:contrast=1.05:saturation=0.82,colorbalance=bs=.025:bm=.015',
    art: `<div style="position:absolute;inset:0;background:linear-gradient(#021028a0,transparent 40%,#021028a0)"></div>${hero}${title('GRAND',285,45,'#efd286')}${title('Sabão Líquido<br>Premium',370,65)}${note('5 L',1410)}${note('Estudo interno · Packshot composto')}`},
  {src: 'denim', at: .3, dur: 1.4, grade: 'eq=contrast=1.06:saturation=.76', art: `<div style="position:absolute;inset:0;background:linear-gradient(#06152c80,transparent 40%,#06152c99)"></div>${title('A matéria,<br>de perto.',285,65)}${note('Tecido ilustrativo · Sem prova de resultado')}`},
  {src: 'water', at: 2.5, dur: 3.4, grade: 'eq=brightness=-0.11:contrast=1.05:saturation=.82,colorbalance=bs=.025:bm=.015',
    art: `<div style="position:absolute;inset:0;background:linear-gradient(#021028a0,transparent 40%,#021028a0)"></div>${hero}${title('Limpeza<br>Profunda',285,78)}${title(esc(concepts[0].cta),1390,40,'#efd286')}${note('GRAND · Estudo interno · Cenas ilustrativas')}`}
];
const phaseB = [
  {src: 'hands', at: 1.3, dur: 2.4, grade: 'eq=brightness=.012:contrast=1.025:saturation=.93,colorbalance=rs=.012:rm=.008',
    art: `<div style="position:absolute;inset:0;background:linear-gradient(#24170c80,transparent 35%,transparent 70%,#24170c88)"></div>${title('Lavagem à mão',285,62)}${note('Stock de categoria · Produto não identificado')}`},
  {src: 'hands', at: 4.1, dur: 2.2, crop: 'crop=960:1706:60:110,', grade: 'eq=brightness=.012:contrast=1.025:saturation=.93,colorbalance=rs=.012:rm=.008',
    art: `<div style="position:absolute;inset:0;background:linear-gradient(#24170c65,transparent 35%,transparent 70%,#24170c88)"></div>${title('De perto.',285,62)}${note('Demonstração de lavagem, não de eficácia')}`},
  {src: 'hands', at: 7, dur: 2.4, grade: 'eq=brightness=.012:contrast=1.025:saturation=.93,colorbalance=rs=.012:rm=.008',
    art: `<div style="position:absolute;inset:0;background:linear-gradient(#24170c65,transparent 35%,transparent 70%,#24170c88)"></div>${title(esc(concepts[1].cta),285,55)}${note('Estudo UGC · Não é uso ou depoimento da GRAND')}`}
];

function audioBed(id) {
  const rate = 48000, duration = 7, n = rate * duration;
  // Original sparse two-note score; no pretend live recording or synthetic testimonial.
  const data = [new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    const t = i / rate, fade = Math.min(1, t / .2, (duration - t) / .3);
    const v = id === 'a' ? .055 * fade * (Math.sin(2 * Math.PI * 146.832 * t) + .5 * Math.sin(2 * Math.PI * 220 * t)) :
      .004 * fade * Math.sin(2 * Math.PI * 110 * t);
    data[0][i] = v; data[1][i] = v;
  }
  const bed = path.join(OUT, id + '-score.wav');writeWav16(bed, {rate, channels: 2, data});
  const mix = path.join(OUT, id + '-sound.wav');
  run(TOOLS.ffmpeg, ['-v','error','-y','-i',bed,'-stream_loop','-1','-i',files['water-audio'],
    '-filter_complex', `[1:a]highpass=f=180,lowpass=f=6500,volume=${id === 'a' ? .35 : .9},afade=t=in:d=0.1,afade=t=out:st=6.7:d=0.3[s];[0:a][s]amix=inputs=2:normalize=0,acompressor=threshold=0.025:ratio=8:attack=5:release=100:makeup=1,loudnorm=I=-16:TP=-1.5:LRA=8[a]`,
    '-map','[a]','-t','7','-ar','48000','-ac','2',mix]);
  return mix;
}
function mediaQc(file) {
  const p = JSON.parse(run(TOOLS.ffprobe,['-v','error','-count_frames','-show_streams','-show_format','-of','json',file]).stdout);
  const v = p.streams.find(s => s.codec_type === 'video'), a = p.streams.find(s => s.codec_type === 'audio');
  const checks = {duration_5_8: Number(p.format.duration) >= 5 && Number(p.format.duration) <= 8,
    portrait_1080: v.width === 1080 && v.height === 1920, h264_420: v.codec_name === 'h264' && v.pix_fmt === 'yuv420p',
    fps_and_frames: v.r_frame_rate === '30/1' && Number(v.nb_read_frames) === 210,
    audio: a?.codec_name === 'aac' && a.sample_rate === '48000' && a.channels === 2};
  const det = run(TOOLS.ffmpeg,['-hide_banner','-nostats','-i',file,'-vf','blackdetect=d=0.1:pic_th=0.98',
    '-af','ebur128=peak=true','-f','null','-']).stderr;
  const summary = det.slice(det.lastIndexOf('Summary:'));
  const I = Number(summary.match(/I:\s+(-?[\d.]+) LUFS/)?.[1]), TP = Number(summary.match(/Peak:\s+(-?[\d.]+) dBFS/)?.[1]);
  checks.no_black = !/black_start:/.test(det);checks.loudness = Number.isFinite(I) && I >= -18 && I <= -14;
  checks.peak = Number.isFinite(TP) && TP <= -1;
  return {status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL', checks, measured: {duration_s:Number(p.format.duration), frames:Number(v.nb_read_frames), LUFS:I, dBTP:TP}};
}
const results = [];
try {
  for (const [index, shots] of [phaseA, phaseB].entries()) {
    const id = index === 0 ? 'a' : 'b', concept = selected[index], t0 = Date.now();
    let plannedAt=0;
    if(concept.duration_s!==7 || shots.some((s,k)=>{
      const planned=concept.narrative[k], matches=planned?.at_s===plannedAt && planned.duration_s===s.dur && planned.asset_ids.includes(s.src);
      plannedAt+=s.dur; return !matches;
    })) throw new Error('DIRECTOR_SCENE_PLAN_REQUIRES_RENDER_REVISION');
    console.log(`[study ${id}] asset-first preflight PASS; 7s only`);
    for (let k = 0; k < shots.length; k++) {
      const shot = shots[k], overlayFile = await overlay(`${id}-art-${k}`, shot.art);
      run(TOOLS.ffmpeg,['-v','error','-y','-ss',String(shot.at),'-threads','1','-i',files[shot.src],
        '-loop','1','-threads','1','-i',overlayFile,'-filter_complex_threads','1','-filter_complex',
        `[0:v]${shot.crop ?? ''}scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,${shot.grade},format=rgb24[v];[1:v]format=rgba[o];[v][o]overlay=0:0:format=rgb,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[out]`,
        '-map','[out]','-an','-t',String(shot.dur),'-c:v','libx264','-preset','veryfast','-crf','18',
        '-threads','2','-r','30','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709',
        '-color_primaries','bt709','-color_trc','bt709',path.join(OUT,`${id}-shot-${k}.mp4`)]);
    }
    writeFileSync(path.join(OUT,id+'-concat.txt'), shots.map((_,k)=>`file '${id}-shot-${k}.mp4'`).join('\n')+'\n');
    const sound = audioBed(id), output = path.join(OUT,id+'-sample.mp4');
    run(TOOLS.ffmpeg,['-v','error','-y','-f','concat','-safe','1','-i',path.join(OUT,id+'-concat.txt'),'-i',sound,
      '-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-b:a','192k','-ar','48000','-ac','2','-t','7','-movflags','+faststart',output]);
    const qc = mediaQc(output), relevant = inventory.filter(a => concept.required_assets.includes(a.id));
    const fingerprint = reviewFingerprint(concept, relevant, sha256File(output)), gates = pendingGates(qc.status === 'PASS');
    const report = {sample:id, concept_id:concept.id, scope:concept.scope, output:path.relative(ROOT,output).replaceAll('\\','/'),
      video_sha256:sha256File(output), elapsed_s:(Date.now()-t0)/1000, technical:qc, gates,
      review_fingerprint:fingerprint, production:scaleDecision(gates,fingerprint), paid_calls:0, additional_contracted_cost_brl:0,
      audio:'CC0 recorded water Foley + original sparse score; not synchronous location audio; no voiceover',
      limitations:concept.limitations};
    writeJson(path.join(OUT,id+'-review.json'),report);results.push(report);
    if(qc.status !== 'PASS') throw new Error('TECHNICAL_QC_FAILED:'+JSON.stringify(qc));
    console.log(`[study ${id}] rendered; TECHNICAL_QC ${qc.status}; creative/human PENDING; scale SUSPENDED`);
  }
} finally {await browser.close();}
writeJson(path.join(OUT,'report.json'),{schema_version:'quality-studies.v1',base:'011fcd3',tools:versions,elapsed_s:(Date.now()-start)/1000,
  samples:results, api_cost_brl:0, publication:false, mass_production:'SUSPENDED_PENDING_EXPLICIT_CREATIVE_APPROVAL'});
