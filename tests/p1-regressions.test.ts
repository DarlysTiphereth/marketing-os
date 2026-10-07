import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { GenerateBatch } from '../src/application/generate.ts';
import { executeQA } from '../src/application/qa.ts';
import { compliancePrecheck } from '../src/compliance/policy.ts';
import { contentHash } from '../src/domain/identity.ts';
import { hash } from '../src/domain/identity.ts';
import { ContextBuilder } from '../src/ai/context.ts';
import { VERSIONS } from '../src/creative-factory/factory.ts';
import { validateProvenance } from '../src/domain/product.ts';
import { StructuredLogger } from '../src/observability/logger.ts';
import { FilesystemRepositories } from '../src/infrastructure/filesystem.ts';
import { fixture, NOW, request } from './helpers.ts';

const quiet = () => new StructuredLogger(() => {});
async function readJson(file: string) { return JSON.parse(await readFile(file, 'utf8')); }
async function writeJson(file: string, value: unknown) { await writeFile(file, `${JSON.stringify(value, null, 2)}\n`); }
function cliReplay(root: string) {
  return spawnSync(process.execPath, [path.resolve('dist/src/cli/generate.js'), '--root', root, '--brand', 'grand',
    '--product', 'test-product', '--idempotency-key', request().idempotency_key], { encoding: 'utf8' });
}
async function outputBytes(root: string, relative = ''): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const file = path.join(relative, entry.name);
    if (entry.isDirectory()) Object.assign(result, await outputBytes(root, file));
    else result[file] = (await readFile(path.join(root, file))).toString('hex');
  }
  return result;
}
function git(root: string, args: string[]) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  return result.stdout;
}

test('P1-01 fixture source and template hashes match checkout bytes; changed evidence fails', async t => {
  const { root, adapter } = await fixture(t);
  for (const brand of ['grand', 'safezone']) {
    const product = await adapter.repositories.products.get(brand, 'test-product');
    for (const source of product.source_references) {
      const content = await readFile(path.join(root, source.source_location), 'utf8');
      assert.equal(contentHash(content), source.source_hash, `${brand}: source hash drift`);
    }
    await validateProvenance(product, adapter.repositories.sources);
    const assets = await adapter.repositories.assets.list(brand, 'test-product');
    for (const asset of assets) {
      assert.equal(contentHash(await readFile(path.join(root, asset.source), 'utf8')), asset.content_hash, `${brand}: template hash drift`);
    }
  }
  const product = await adapter.repositories.products.get('grand', 'test-product');
  const sourcePath = path.join(root, product.source_references[0]!.source_location);
  await writeFile(sourcePath, `${await readFile(sourcePath, 'utf8')} `);
  await assert.rejects(validateProvenance(product, adapter.repositories.sources), /Source hash mismatch/);
});

test('F-04 real Git commits/clones preserve LF hashes and raw bytes under true/input/false; negative control drifts', async t => {
  const { root } = await fixture(t);
  await cp(path.resolve('.gitattributes'), path.join(root, '.gitattributes'));
  const rawDir = path.join(root, 'products/grand/sources/raw');
  await mkdir(rawDir, { recursive: true });
  const exactBytes = Buffer.from('Exact source\r\nMixed line ending\nKeep bytes\r\n', 'utf8');
  const rawFile = path.join(rawDir, 'original.txt');
  await writeFile(rawFile, exactBytes);
  git(root, ['init', '--quiet']);
  git(root, ['config', 'core.autocrlf', 'false']);
  const files = ['.gitattributes', ...git(root, ['ls-files', '--others', '--exclude-standard', 'brands', 'products']).trim().split(/\r?\n/)];
  const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  const originals = new Map<string, Buffer>();
  for (const file of files) {
    const bytes = await readFile(path.join(root, file));
    originals.set(file, file.includes('/sources/raw/') ? bytes : Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n')));
    // Seed ordinary text as CRLF, so the commit must actually normalize it.
    if (!file.includes('/sources/raw/')) await writeFile(path.join(root, file), bytes.toString('utf8').replace(/\r?\n/g, '\r\n'));
  }
  const commit = (message: string) => git(root, ['-c', 'user.name=Foundation Test', '-c', 'user.email=foundation@example.invalid',
    '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', message]);
  git(root, ['add', '--', '.gitattributes', 'brands', 'products']);
  commit('LF and exact-byte fixture test');
  for (const autocrlf of ['true', 'input', 'false']) {
    const clone = path.join(root, `clone-${autocrlf}`);
    git(root, ['clone', '--quiet', '--no-local', '--config', `core.autocrlf=${autocrlf}`, '--config', 'core.eol=crlf', root, clone]);
    assert.equal(git(clone, ['config', 'core.autocrlf']).trim(), autocrlf);
    assert.equal(git(clone, ['config', 'core.eol']).trim(), 'crlf');
    for (const [file, expected] of originals) {
      const actual = await readFile(path.join(clone, file));
      assert.deepEqual(actual, expected, `${autocrlf}: ${file} checkout bytes`);
      assert.equal(sha(actual), sha(expected), `${autocrlf}: ${file} SHA256`);
    }
    const adapter = new FilesystemRepositories(clone);
    for (const brand of ['grand', 'safezone']) {
      await validateProvenance(await adapter.repositories.products.get(brand, 'test-product'), adapter.repositories.sources);
      await adapter.repositories.assets.list(brand, 'test-product');
    }
    const generated = await new GenerateBatch(adapter.repositories, quiet(), adapter.outputRoot, () => NOW).execute(request());
    assert.equal(generated.artifacts.qa.pass, 18);
    assert.deepEqual(await readFile(path.join(clone, 'products/grand/sources/raw/original.txt')), exactBytes);
  }
  // Control proves a real initial checkout loses hash identity without the attributes.
  await unlink(path.join(root, '.gitattributes'));
  git(root, ['add', '--', '.gitattributes']); commit('Remove protection for negative control');
  const control = path.join(root, 'clone-unprotected');
  git(root, ['clone', '--quiet', '--no-local', '--config', 'core.autocrlf=true', '--config', 'core.eol=crlf', root, control]);
  const evidenceFile = 'products/grand/sources/test-product.json';
  const unprotected = await readFile(path.join(control, evidenceFile));
  assert.ok(unprotected.includes(Buffer.from('\r\n')));
  assert.notEqual(sha(unprotected), sha(originals.get(evidenceFile)!));
});

test('P1-02 identical replay at a later check time returns the same traceable batch', async t => {
  const { adapter, service } = await fixture(t);
  const first = await service.execute(request());
  const later = new GenerateBatch(adapter.repositories, quiet(), adapter.outputRoot, () => '2026-10-06T12:00:00.000Z');
  const replay = await later.execute(request());
  assert.equal(replay.reused, true);
  assert.deepEqual(replay.artifacts, first.artifacts);
  assert.equal(replay.artifacts.summary.status, 'READY_FOR_PRODUCTION');
});

test('P1-02 product version change rejects replay without overwriting or duplicating the batch', async t => {
  const { root, adapter, service } = await fixture(t);
  const first = await service.execute(request());
  const file = path.join(root, 'products/grand/test-product.json');
  const product = await readJson(file); product.product_version = 'fixture-2'; await writeJson(file, product);
  await assert.rejects(service.execute(request()), /^Error: STALE_INPUTS:/);
  assert.deepEqual(await adapter.load(first.artifacts.batch.batch_id), first.artifacts);
  assert.equal((await readdir(adapter.outputRoot)).filter(name => !name.startsWith('.')).length, 1);
});

test('P1-02 product content change without a version bump rejects replay', async t => {
  const { root, service } = await fixture(t);
  await service.execute(request());
  const file = path.join(root, 'products/grand/test-product.json');
  const product = await readJson(file); product.name = 'TEST_FIXTURE — Nome alterado'; await writeJson(file, product);
  await assert.rejects(service.execute(request()), /^Error: STALE_INPUTS:/);
});

test('P1-02 category change to BLOCK never returns READY and CLI reports stable STALE_INPUTS exit 3', async t => {
  const { root, adapter, service } = await fixture(t);
  await service.execute(request());
  const file = path.join(root, 'products/grand/test-product.json');
  const product = await readJson(file); product.category = 'TOBACCO'; await writeJson(file, product);
  const brand = await adapter.repositories.brands.get('grand');
  assert.equal(compliancePrecheck(brand, product, request(), NOW).decision, 'BLOCK');
  await assert.rejects(service.execute(request()), /^Error: STALE_INPUTS:/);
  for (let attempt = 0; attempt < 2; attempt++) {
    const replay = spawnSync(process.execPath, [path.resolve('dist/src/cli/generate.js'), '--root', root, '--brand', 'grand',
      '--product', 'test-product', '--idempotency-key', request().idempotency_key], { encoding: 'utf8' });
    assert.equal(replay.status, 3, replay.stderr);
    assert.ok(!replay.stdout.includes('READY_FOR_PRODUCTION'));
    assert.equal(JSON.parse(replay.stderr.trim()).error, 'STALE_INPUTS');
  }
});

test('P1-02 changed brand compliance profile rejects replay after reevaluating policy', async t => {
  const { root, adapter, service } = await fixture(t);
  await service.execute(request());
  const file = path.join(root, 'brands/grand/context.json');
  const brand = await readJson(file); brand.compliance_profile = 'REGULATED_CONSERVATIVE'; await writeJson(file, brand);
  const product = await adapter.repositories.products.get('grand', 'test-product');
  assert.equal(compliancePrecheck(brand, product, request(), NOW).decision, 'REVIEW');
  await assert.rejects(service.execute(request()), /^Error: STALE_INPUTS:/);
});

test('P1-02 changed compliance policy is independently rejected even when input fingerprint still matches', async t => {
  const { adapter, service } = await fixture(t);
  const { artifacts } = await service.execute(request());
  // Simulate a batch from a previous policy while leaving its brand/product/fingerprint identical.
  const previousPolicy = structuredClone(artifacts);
  previousPolicy.compliance.policy_version = 'internal-conservative-previous';
  const repositories = { ...adapter.repositories, batches: { ...adapter.repositories.batches,
    findByIdempotencyKey: async () => previousPolicy } };
  const replay = new GenerateBatch(repositories, quiet(), adapter.outputRoot, () => NOW);
  await assert.rejects(replay.execute(request()), /^Error: STALE_INPUTS:/);
});

test('P1-02 changed source bytes without changing declared metadata invalidate replay', async t => {
  const { root, service } = await fixture(t);
  await service.execute(request());
  const source = path.join(root, 'products/grand/sources/test-product.json');
  await writeFile(source, `${await readFile(source, 'utf8')} `);
  await assert.rejects(service.execute(request()), /^Error: STALE_INPUTS:/);
});

test('P1-03 pre-fix template snapshot cannot replay after the label representation changes', async t => {
  const { adapter, service } = await fixture(t);
  const { artifacts } = await service.execute(request());
  const legacy = structuredClone(artifacts);
  const context = new ContextBuilder().build('MINIMAL', legacy.brand, legacy.product);
  legacy.batch.input_fingerprint = hash({ brand: legacy.brand, product: legacy.product, context,
    versions: { ...VERSIONS, template: 'faceless-1' } });
  const repositories = { ...adapter.repositories, batches: { ...adapter.repositories.batches,
    findByIdempotencyKey: async () => legacy } };
  const replay = new GenerateBatch(repositories, quiet(), adapter.outputRoot, () => NOW);
  await assert.rejects(replay.execute(request()), /^Error: STALE_INPUTS:/);
});

async function prepareRealData(root: string) {
  // Only isolated test records exercise REAL_DATA. Repository business fixtures remain unchanged.
  const brandFile = path.join(root, 'brands/grand/context.json');
  const productFile = path.join(root, 'products/grand/test-product.json');
  const brand = await readJson(brandFile), product = await readJson(productFile);
  const fact = 'Informação documentada para teste de contrato.';
  brand.data_label = 'REAL_DATA'; brand.data_notice = 'REAL_DATA metadata for an isolated contract test';
  product.data_label = 'REAL_DATA'; product.data_notice = brand.data_notice; product.knowledge_status = 'VERIFIED';
  product.name = 'Produto documentado de teste'; product.official_description.text = fact;
  const evidence = `${JSON.stringify({ brand_id: 'grand', product_id: 'test-product', facts: [fact] }, null, 2)}\n`;
  product.source_references[0].source_type = 'MANUAL'; product.source_references[0].source_hash = contentHash(evidence);
  await writeFile(path.join(root, product.source_references[0].source_location), evidence);
  const assetsFile = path.join(root, 'brands/grand/assets.json');
  const assets = await readJson(assetsFile);
  const templateFile = path.join(root, assets[0].source);
  const template = await readJson(templateFile); template.data_label = 'REAL_DATA'; template.data_notice = brand.data_notice;
  await writeJson(templateFile, template); assets[0].data_label = 'REAL_DATA';
  assets[0].content_hash = contentHash(await readFile(templateFile, 'utf8'));
  await writeJson(brandFile, brand); await writeJson(productFile, product); await writeJson(assetsFile, assets);
  return { fact, evidence, productFile };
}

test('P1-03 REAL_DATA remains metadata only; sourced real-data contract content passes QA without internal labels', async t => {
  const { root, adapter, service } = await fixture(t);
  const { fact, evidence } = await prepareRealData(root);
  const { artifacts: a } = await service.execute(request());
  assert.equal(a.qa.pass, 18); assert.equal(a.qa.fail, 0);
  assert.equal(a.product.data_label, 'REAL_DATA'); assert.equal(a.product.knowledge_status, 'VERIFIED');
  assert.equal(a.product.source_references[0]!.source_type, 'MANUAL');
  assert.equal(a.product.source_references[0]!.source_hash, contentHash(evidence));
  await validateProvenance(a.product, adapter.repositories.sources);
  for (const manifest of a.manifests) {
    assert.equal(manifest.data_label, 'REAL_DATA');
    assert.deepEqual(manifest.claims[0], a.product.official_description);
    const publicText = [manifest.script, manifest.caption, manifest.cta, manifest.voiceover_text, ...manifest.on_screen_text,
      ...manifest.image_prompts, ...manifest.video_prompts, ...manifest.shot_list.map(shot => shot.description)].join('\n');
    assert.ok(!/REAL_DATA|TEST_FIXTURE|NOT_REAL_PRODUCT_DATA/i.test(publicText));
    assert.ok(publicText.includes(fact));
  }
  const altered = structuredClone(a.manifests); altered[0]!.video_prompts.push('REAL_DATA');
  const qa = executeQA({ batchId: a.batch.batch_id, brand: a.brand, product: a.product,
    variants: a.variants.map(v => ({ ...v, status: 'QA_REVIEW' as const })), manifests: altered,
    assets: a.assets, matrix: a.matrix, compliance: a.compliance, cost: a.cost, now: NOW });
  assert.equal(qa.reports[0]!.status, 'FAIL');
  assert.ok(qa.reports[0]!.issues.includes('Internal data label leaked into media text'));
});

const replayMutations = [
  { id: 'M1', name: 'faceless_verified=false', file: 'brands/grand/assets.json', mutate: (value: any) => { value[0].faceless_verified = false; } },
  { id: 'M2a', name: 'catalog content_hash tampered', file: 'brands/grand/assets.json', mutate: (value: any) => { value[0].content_hash = '0'.repeat(64); } },
  { id: 'M2b', name: 'template bytes tampered', file: 'brands/grand/test-template.json', append: true },
  { id: 'M3a', name: 'asset removed from catalog', file: 'brands/grand/assets.json', mutate: (value: any[]) => { value.splice(0, 1); } },
  { id: 'M3b', name: 'physical template deleted', file: 'brands/grand/test-template.json', remove: true },
  { id: 'M4a', name: 'product deleted', file: 'products/grand/test-product.json', remove: true },
  { id: 'M4b', name: 'brand deleted', file: 'brands/grand/context.json', remove: true },
];
for (const mutation of replayMutations) {
  test(`F-01/F-03 ${mutation.id} ${mutation.name}: exit 3, immutable snapshot, restored replay exit 0`, async t => {
    const { root, adapter, service } = await fixture(t);
    const first = await service.execute(request());
    const saved = await outputBytes(adapter.outputRoot);
    const file = path.join(root, mutation.file), original = await readFile(file);
    try {
      if ('remove' in mutation) await unlink(file);
      else if ('append' in mutation) await writeFile(file, Buffer.concat([original, Buffer.from(' ')]));
      else {
        const value = JSON.parse(original.toString('utf8')); mutation.mutate(value); await writeJson(file, value);
      }
      await assert.rejects(service.execute(request()), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /^STALE_INPUTS:/);
        if (['M2a', 'M2b', 'M3b', 'M4a', 'M4b'].includes(mutation.id)) assert.ok(error.cause instanceof Error, 'validation cause retained internally');
        return true;
      });
      const replay = cliReplay(root);
      assert.equal(replay.status, 3, replay.stderr);
      assert.equal(JSON.parse(replay.stderr.trim()).error, 'STALE_INPUTS');
      assert.ok(!replay.stdout.includes('READY_FOR_PRODUCTION'));
      assert.ok(!replay.stderr.includes(root)); assert.ok(!/\n\s+at /.test(replay.stderr));
      assert.deepEqual(await outputBytes(adapter.outputRoot), saved, 'all snapshot bytes unchanged; no partial files');
      assert.equal((await readdir(adapter.outputRoot)).filter(name => name !== '.locks').length, 1, 'no new or partial batch');
      assert.deepEqual(await adapter.load(first.artifacts.batch.batch_id), first.artifacts);
    } finally { await writeFile(file, original); }
    const restored = cliReplay(root);
    assert.equal(restored.status, 0, restored.stderr);
    const summary = JSON.parse(restored.stdout.slice(restored.stdout.indexOf('{')));
    assert.equal(summary.idempotent_replay, true); assert.equal(summary.status, 'READY_FOR_PRODUCTION');
    assert.equal(summary.batch_id, first.artifacts.batch.batch_id);
    assert.deepEqual(await outputBytes(adapter.outputRoot), saved);
  });
}

test('F-01 usage_count alone is derived and does not invalidate replay', async t => {
  const { root, service } = await fixture(t);
  const first = await service.execute(request());
  const file = path.join(root, 'brands/grand/assets.json'), original = await readFile(file);
  try {
    const assets = JSON.parse(original.toString('utf8')); assets[0].usage_count = 999; await writeJson(file, assets);
    const replay = await service.execute(request());
    assert.equal(replay.reused, true); assert.deepEqual(replay.artifacts, first.artifacts);
    assert.equal(cliReplay(root).status, 0);
  } finally { await writeFile(file, original); }
});

for (const marker of ['tEsT_fIxTuRe', 'nOt_ReAl_PrOdUcT_dAtA']) {
  test(`F-05/M7 REAL_DATA with ${marker} in deterministic media fails QA, preserves provenance, restores clean PASS`, async t => {
    const { root, adapter, service } = await fixture(t);
    const { productFile } = await prepareRealData(root);
    const original = await readFile(productFile), product = JSON.parse(original.toString('utf8'));
    const provenance = structuredClone(product.source_references);
    try {
      product.name = `Produto ${marker} documentado`; await writeJson(productFile, product);
      const { artifacts } = await service.execute(request());
      assert.equal(artifacts.qa.status, 'FAIL'); assert.equal(artifacts.qa.pass, 0); assert.equal(artifacts.qa.fail, 18);
      assert.notEqual(artifacts.summary.status, 'READY_FOR_PRODUCTION');
      assert.ok(artifacts.qa.reports.every(report => report.issues.includes('Fixture placeholder leaked into non-fixture media text')));
      assert.equal(artifacts.product.data_label, 'REAL_DATA');
      assert.ok(artifacts.manifests.every(manifest => manifest.data_label === 'REAL_DATA'));
      assert.deepEqual(artifacts.product.source_references, provenance);
      await validateProvenance(artifacts.product, adapter.repositories.sources);
    } finally { await writeFile(productFile, original); }
    const clean = await service.execute(request({ idempotency_key: 'restored-real-data' }));
    assert.equal(clean.artifacts.qa.pass, 18); assert.equal(clean.artifacts.qa.fail, 0);
  });
}
