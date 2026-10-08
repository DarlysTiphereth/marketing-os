// Orchestrator: creative template + variant selection -> MP4 + manifest/creative/assets/cost/qc/run.log.
// Usage: node pipeline/produce.ts --hook hook-a --body body-1 --cta cta-a [--style deep-blue] [--voice maria]
//        [--pacing standard|fast] [--captions karaoke|off] [--stack remotion] [--preview]
import {existsSync, linkSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseArgs} from 'node:util';
import {REPO, ROOT, RunLog, TOOLS, gitInfo, readJson, run, sha256, sha256File, timed, writeJson} from './lib.ts';
import {combinationSpace, expand, loadTemplate, variantId} from './variants.ts';
import {synthesize} from './voice.ts';
import {buildTimeline} from './timeline.ts';
import {buildAudio} from './audio.ts';
import {encode, getBundle, renderVideoFrames} from './render.ts';
import {contactSheet, technicalQc} from './qc.ts';
import {ensureLayout, managed} from '../../../ops/config.ts';
import {Cas} from '../../../ops/storage/cas.ts';

const {values: a} = parseArgs({options: {
  creative: {type: 'string', default: 'creatives/grand-sabao-5l.creative.json'},
  hook: {type: 'string', default: 'hook-a'}, body: {type: 'string', default: 'body-1'}, cta: {type: 'string', default: 'cta-a'},
  style: {type: 'string', default: 'deep-blue'}, voice: {type: 'string', default: 'maria'}, music: {type: 'string', default: 'pulse-116'},
  pacing: {type: 'string', default: 'standard'}, captions: {type: 'string', default: 'karaoke'},
  stack: {type: 'string', default: 'remotion'}, preview: {type: 'boolean', default: false}, concurrency: {type: 'string', default: '4'},
  'job-id': {type: 'string'}, 'runs-dir': {type: 'string'},
}});

const t0 = performance.now();
// Code fingerprint captured BEFORE any stage runs, so a run can be tied to the exact renderer source.
const codeFiles = ['src', 'pipeline', 'pipeline/tts'].flatMap((d) => readdirSync(path.join(ROOT, d)).filter((f) => /\.(ts|tsx|ps1)$/.test(f)).map((f) => `${d}/${f}`)).sort();
const codeSha256 = Object.fromEntries(codeFiles.map((f) => [f, sha256File(path.join(ROOT, f))]));
const codeFingerprint = sha256(JSON.stringify(codeSha256)).slice(0, 16);
const srcFingerprint = sha256(JSON.stringify(Object.entries(codeSha256).filter(([f]) => f.startsWith('src/')))).slice(0, 16); // bundle depends only on src/
const creativePath = path.resolve(ROOT, a.creative!);
const rawTemplate = readFileSync(creativePath);
const template = loadTemplate(JSON.parse(rawTemplate.toString('utf8')));
const templateHash = sha256(rawTemplate);
const selection = {hook: a.hook, body: a.body, cta: a.cta, style: a.style, voice: a.voice, music: a.music, pacing: a.pacing, captions: a.captions};
const ex = expand(template, selection);
const vid = variantId(templateHash, ex.sel);
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}_${vid}${a.preview ? '_preview' : ''}`;
const runDir = a['runs-dir'] ? path.resolve(a['runs-dir'], runId) : path.join(REPO, 'experiments', a.stack!, 'runs', runId);
ensureLayout();
const cas = new Cas();
const framesDir = managed('tmp', `frames-${runId}`); // managed tmp, removed at the end of the run
mkdirSync(runDir, {recursive: true});
const log = new RunLog(path.join(runDir, 'run.log'));
const failures: string[] = [];
log.log('init', `variant ${vid}`, {selection: ex.sel, stack: a.stack, preview: a.preview, code_fingerprint: codeFingerprint});

try {
  // 1. Asset integrity (missing/changed assets fail before any work).
  const [assets, assetTime] = await timed(() => Object.entries(template.assets).map(([name, as]) => {
    const p = path.join(ROOT, as.path);
    const actual = sha256File(p);
    if (actual !== as.sha256) throw new Error(`asset ${name} hash mismatch`);
    return {name, path: as.path, sha256: actual, bytes: statSync(p).size, kind: as.kind, status: as.status, source: 'local_brand_asset', generation_model: 'none', cost_usd: 0};
  }));
  log.log('assets', `${assets.length} assets verified`, {seconds: assetTime});
  // Stage assets content-addressed: the public dir only contains this creative's assets, named by logical key.
  const assetSet = sha256(assets.map((x) => `${x.name}:${x.sha256}`).sort().join('|')).slice(0, 12);
  const publicDir = managed('tmp', `public-${assetSet}`);
  const staged: Record<string, string> = {};
  for (const x of assets) {
    const ref = cas.put(path.join(ROOT, x.path), {name: `${template.creative_id}/${x.name}`, class: 'cache', run_id: runId});
    const file = `${x.name}${path.extname(x.path).toLowerCase()}`;
    cas.materialize(ref.sha256, path.join(publicDir, file));
    staged[x.name] = file;
  }
  const bundleDir = managed('cache', 'bundles', `${srcFingerprint}-${assetSet}`);

  // 2. Voice (local, cached).
  const voice = ex.voice;
  const rate = voice.rate_pct + (ex.sel.pacing === 'fast' ? 8 : 0);
  const [lines, voiceTime] = await timed(() => ex.scenes.map((s) => synthesize(s.voiceover, voice.voice_name, rate, voice.provider)));
  log.log('voice', `${lines.length} lines (${lines.filter((l) => l.cached).length} cache hits)`, {seconds: voiceTime});

  // 3. Timeline.
  const tl = buildTimeline({variant_id: vid, creative_id: template.creative_id, selection: ex.sel, style: ex.style, scenes: ex.scenes, lines, fps: 30,
    assets: staged, display: template.display});
  writeJson(path.join(runDir, 'timeline.json'), tl);
  log.log('timeline', `duration ${tl.duration}s, ${tl.scenes.length} scenes`);

  // 4. Audio (music + sfx + ducking + loudnorm).
  const [audio, audioTime] = await timed(() => buildAudio(tl, lines, {bpm: ex.music.bpm, seed: ex.music.seed, workDir: runDir}));
  log.log('audio', 'mix rendered', {seconds: audioTime, loudnorm_input_i: audio.loudnorm_pass1.input_i});

  // 5. Frames + encode.
  const serveUrl = await getBundle({publicDir, outDir: bundleDir});
  const [fr, frameTime] = await timed(() => renderVideoFrames(tl, framesDir, {concurrency: Number(a.concurrency), serveUrl}));
  log.log('render', `${fr.frames} frames`, {seconds: frameTime, warnings: fr.warnings.length});
  if (fr.warnings.length) writeJson(path.join(runDir, 'browser-warnings.json'), fr.warnings);
  const mp4 = path.join(runDir, 'final.mp4');
  const [enc, encodeTime] = await timed(() => encode(framesDir, fr.files, audio.final, mp4, 30));
  log.log('encode', 'final.mp4 written', {seconds: encodeTime});

  // 6. QC.
  const [qc, qcTime] = await timed(() => technicalQc(mp4, tl));
  const sheet = contactSheet(framesDir, fr.files, tl, path.join(runDir, 'contact-sheet.jpg'));
  log.log('qc', `technical ${qc.verdict}`, {seconds: qcTime, failed: qc.checks.filter((c) => c.status !== 'PASS').map((c) => c.id)});
  rmSync(framesDir, {recursive: true, force: true});
  rmSync(path.join(runDir, 'premix.wav'), {force: true});
  // Final MP4 goes to the content-addressed store (candidate retention); the run dir keeps a hardlink (0 extra bytes).
  const stored = cas.put(mp4, {name: `${template.creative_id}/${vid}.mp4`, class: 'candidate', run_id: runId});
  unlinkSync(mp4);
  try { linkSync(stored.path, mp4); } catch { cas.materialize(stored.sha256, mp4); }

  const total = (performance.now() - t0) / 1000;
  const remotionVersion = readJson<{version: string}>(path.join(ROOT, 'node_modules/remotion/package.json')).version;
  const ffv = run(TOOLS.ffmpeg, ['-hide_banner', '-version']).stdout.split('\n')[0];
  const git = gitInfo();

  writeJson(path.join(runDir, 'creative.json'), {schema_version: template.schema_version, template: path.relative(REPO, creativePath).replaceAll('\\', '/'), template_sha256: templateHash,
    variant_id: vid, selection: ex.sel, objective: template.objective, audience: template.audience, platforms: template.platforms, awareness_level: template.awareness_level,
    angle: template.angle, promise: template.promise, problem: template.problem, mechanism: template.mechanism, proof: template.proof, benefits: template.benefits,
    objections: template.objections, claims_used: ex.claims, style: ex.style, voice: ex.voice, music: ex.music, scenes: tl.scenes});
  writeJson(path.join(runDir, 'assets.json'), {brand_assets: assets,
    voice_lines: lines.map((l, i) => ({scene_id: ex.scenes[i]!.scene_id, text: ex.scenes[i]!.voiceover, provider: l.provider, voice: l.voice, source_rate_hz: l.source_rate_hz, cache_key: l.cache_key, cached: l.cached, seconds: +l.seconds.toFixed(3)})),
    music: {...ex.music, generator: 'pipeline/audio.ts music()', license: 'procedurally generated in-house, no samples'},
    sfx_cues: audio.cues, generated_media: 'none (no image/video generation models used)'});
  writeJson(path.join(runDir, 'cost.json'), {currency: 'USD', evidence: 'MEASURED for API spend (no paid API called); compute time MEASURED; other items UNKNOWN',
    total_cost: 0, cost_script: 0, cost_images: 0, cost_video_generation: 0, cost_voice: 0, cost_music: 0, cost_render: 0,
    paid_api_calls: 0, llm_tokens_for_authoring: 'UNKNOWN (copy/storyboard authored by the Claude Code session; tokens not metered here)',
    electricity: 'UNKNOWN', compute_time_s: +total.toFixed(2), human_minutes: 0, human_minutes_note: 'no human edit during the run; human/agent authoring time before the run UNKNOWN',
    elapsed_time_s: +total.toFixed(2)});
  writeJson(path.join(runDir, 'qc.json'), {technical: {verdict: qc.verdict, checks: qc.checks, loudness: qc.loudness}, metrics: qc.metrics,
    contact_sheet: {file: 'contact-sheet.jpg', frames: sheet.frames}, visual: 'PENDING_REVIEW', creative: 'PENDING_REVIEW',
    latency_s: {research_time: 'NOT_APPLICABLE (sources pre-supplied)', script_time: 'UNKNOWN (agent-authored template)', asset_time: +(assetTime + voiceTime + audioTime).toFixed(2),
      voice_time: +voiceTime.toFixed(2), audio_time: +audioTime.toFixed(2), render_time: +(frameTime + encodeTime).toFixed(2), frame_render_time: +frameTime.toFixed(2), encode_time: +encodeTime.toFixed(2), qc_time: +qcTime.toFixed(2), total_time: +total.toFixed(2)}});
  writeJson(path.join(runDir, 'manifest.json'), {run_id: runId, variant_id: vid, stack: a.stack, renderer: `remotion@${remotionVersion} renderFrames (jpeg q93) + external ffmpeg libx264 crf18`,
    status: qc.verdict === 'PASS' ? 'RENDERED_TECH_PASS' : 'RENDERED_TECH_FAIL', created_at: new Date().toISOString(), git_commit: git.commit, git_dirty: git.dirty,
    code_fingerprint: codeFingerprint, code_sha256: codeSha256,
    output: {file: 'final.mp4', sha256: sha256File(mp4), bytes: statSync(mp4).size, duration_s: tl.duration},
    tools: {node: process.version, remotion: remotionVersion, ffmpeg: ffv, chrome: TOOLS.chrome.includes('chrome-headless-shell') ? 'chrome-headless-shell (media-stack-lab install)' : TOOLS.chrome,
      tts: 'Windows OneCore (WinRT) local', os: `${os.type()} ${os.release()}`, cpu: os.cpus()[0]?.model, cpus: os.cpus().length, ram_bytes: os.totalmem()},
    models: {llm: 'none at runtime (template authored by Claude Code session)', image: 'none', video: 'none', voice: `${lines[0]?.voice} (OneCore, local)`, music: 'procedural seed ' + ex.music.seed},
    seeds: {music: ex.music.seed, sfx: ex.music.seed + 7, visual: 'remotion random() with fixed string seeds'},
    parameters: {selection: ex.sel, voice_rate_pct: rate, encode: enc.ffmpeg_args, concurrency: Number(a.concurrency)},
    combination_space: combinationSpace(template), files: ['manifest.json', 'creative.json', 'timeline.json', 'assets.json', 'cost.json', 'qc.json', 'run.log', 'final.mp4', 'contact-sheet.jpg', 'mix.wav'],
    failures});
  log.log('done', `${runDir}`, {seconds: total});
  if (a['job-id']) writeJson(managed('runs', `${a['job-id']}.json`), {run_dir: runDir, output_sha256: stored.sha256, output_bytes: statSync(stored.path).size, qc_verdict: qc.verdict, deduplicated: stored.deduplicated});
  writeFileSync(path.join(REPO, 'experiments', a.stack!, 'runs', 'LATEST'), runId + '\n');
} catch (e) {
  failures.push(String((e as Error).stack ?? e));
  log.log('error', String((e as Error).message));
  writeJson(path.join(runDir, 'manifest.json'), {run_id: runId, variant_id: vid, status: 'FAILED', failures});
  process.exitCode = 1;
} finally {
  if (existsSync(framesDir)) rmSync(framesDir, {recursive: true, force: true});
  // A crashed render can leave Chrome handles open and keep the process alive (observed). Workers bill by wall time:
  // always terminate once manifests are written.
  setTimeout(() => process.exit(process.exitCode ?? 0), 2000).unref();
}
