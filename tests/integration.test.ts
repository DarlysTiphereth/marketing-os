import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { executeQA } from '../src/application/qa.ts';
import { parseRequest } from '../src/cli/generate.ts';
import { FilesystemRepositories, safePath } from '../src/infrastructure/filesystem.ts';
import { StructuredLogger } from '../src/observability/logger.ts';
import { fixture, NOW, request } from './helpers.ts';

test('31 duplicate batch request returns existing batch across repository instances', async t => {
  const { service, adapter } = await fixture(t);
  const first = await service.execute(request()); const second = await service.execute(request());
  assert.equal(first.reused, false); assert.equal(second.reused, true);
  assert.deepEqual(first.artifacts, second.artifacts);
  assert.equal((await adapter.repositories.batches.findByIdempotencyKey('grand', 'test-batch'))!.batch.batch_id, first.artifacts.batch.batch_id);
  const directories = (await readdir(adapter.outputRoot)).filter(name => !name.startsWith('.'));
  assert.equal(directories.length, 1);
});
test('concurrent identical requests return one complete batch', async t => {
  const { service, adapter } = await fixture(t);
  const results = await Promise.all([service.execute(request()), service.execute(request())]);
  assert.equal(results.filter(r => r.reused).length, 1);
  assert.equal(results[0]!.artifacts.batch.batch_id, results[1]!.artifacts.batch.batch_id);
  assert.equal((await adapter.load(results[0]!.artifacts.batch.batch_id)).manifests.length, 18);
});
test('idempotency key conflict fails explicitly instead of silently returning unrelated result', async t => {
  const { service } = await fixture(t); await service.execute(request());
  await assert.rejects(service.execute(request({ angles: 2 })), /IDEMPOTENCY_CONFLICT/);
});
test('end-to-end persistence has required reports and 18 valid manifests, all READY_FOR_PRODUCTION', async t => {
  const { service, adapter } = await fixture(t); const { artifacts } = await service.execute(request());
  assert.equal(artifacts.qa.pass, 18); assert.equal(artifacts.qa.fail, 0);
  assert.ok(artifacts.variants.every(v => v.status === 'READY_FOR_PRODUCTION'));
  const directory = path.join(adapter.outputRoot, artifacts.batch.batch_id);
  const files = await readdir(directory);
  for (const file of ['batch.json', 'product-knowledge.json', 'strategy.json', 'generation-matrix.json', 'variants.json',
    'qa-report.json', 'cost-report.json', 'efficiency-report.json', 'execution-summary.json', 'manifests']) assert.ok(files.includes(file), file);
  assert.equal((await readdir(path.join(directory, 'manifests'))).length, 18);
});
test('QA rejects unsupported text, missing assets, faces, stale versions and duplicates', async t => {
  const { service } = await fixture(t); const { artifacts: a } = await service.execute(request());
  const qaInput = () => ({ batchId: a.batch.batch_id, brand: a.brand, product: a.product,
    variants: a.variants.map(v => ({ ...v, status: 'QA_REVIEW' as const })), manifests: structuredClone(a.manifests),
    assets: a.assets, matrix: a.matrix, compliance: a.compliance, cost: a.cost, now: NOW });
  assert.equal(executeQA(qaInput()).status, 'PASS');
  const unsupported = qaInput(); unsupported.manifests[0]!.caption += ' cura tudo';
  assert.equal(executeQA(unsupported).reports[0]!.status, 'FAIL');
  const missing = qaInput(); missing.assets = []; assert.equal(executeQA(missing).fail, 18);
  const faces = qaInput(); Reflect.set(faces.manifests[0]!, 'faceless_required', false);
  assert.equal(executeQA(faces).reports[0]!.status, 'FAIL');
  const stale = qaInput(); stale.variants[0]!.brand_version = 'outdated'; assert.equal(executeQA(stale).reports[0]!.status, 'FAIL');
  const duplicate = qaInput(); duplicate.variants.push(duplicate.variants[0]!); assert.equal(executeQA(duplicate).status, 'FAIL');
  const empty = qaInput(); empty.variants = []; empty.manifests = []; assert.equal(executeQA(empty).status, 'FAIL');
});
test('CLI executes real offline command, validates arguments, reports REVIEW with exit code 2', async t => {
  const { root } = await fixture(t);
  const cli = path.resolve('dist/src/cli/generate.js');
  const common = ['--root', root, '--product', 'test-product', '--angles', '3', '--hooks', '3', '--visuals', '2', '--budget', '5'];
  const result = spawnSync(process.execPath, [cli, '--brand', 'grand', ...common], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /"variants_created": 18/);
  const replay = spawnSync(process.execPath, [cli, '--brand', 'grand', ...common], { encoding: 'utf8' });
  assert.equal(replay.status, 0); assert.match(replay.stdout, /"idempotent_replay": true/);
  const regulated = spawnSync(process.execPath, [cli, '--brand', 'safezone', ...common], { encoding: 'utf8' });
  assert.equal(regulated.status, 2); assert.match(regulated.stdout, /"compliance": "REVIEW"/);
  assert.throws(() => parseRequest(['--brand', '../grand', '--product', 'test-product']));
  assert.throws(() => parseRequest(['--brand', 'grand', '--product', 'test-product', '--angles', '0']));
  assert.throws(() => parseRequest(['--brand', 'grand', '--product', 'test-product', '--budget', 'NaN']));
  assert.throws(() => parseRequest(['--brand', 'grand', '--product', 'test-product', '--unknown', 'x']));
  assert.equal(parseRequest(['--', '--brand', 'grand', '--product', 'test-product'])!.request.angles, 3);
});
test('path boundaries and missing reusable assets fail before writing completed batch', async t => {
  const { root, adapter, service } = await fixture(t);
  assert.throws(() => safePath(root, '../outside'), /escapes/);
  assert.throws(() => new FilesystemRepositories(root, root), /Absolute/);
  await assert.rejects(adapter.repositories.products.get('../safezone', 'test-product'));
  await writeFile(path.join(root, 'brands/grand/assets.json'), '[]');
  await assert.rejects(service.execute(request()), /MISSING_TEMPLATE_ASSET/);
  assert.equal((await readdir(adapter.outputRoot)).filter(name => !name.startsWith('.')).length, 0);
});
test('structured logs discard unexpected fields and arbitrary decision strings', () => {
  const lines: string[] = []; const logger = new StructuredLogger(line => lines.push(line));
  logger.log({ event: 'BATCH_STARTED', correlation_id: '00112233-4455-5677-8899-aabbccddeeff', batch_id: null,
    brand_id: 'grand', product_id: 'test-product', decision: 'secret-data',
    ...{ api_key: 'SHOULD_NEVER_APPEAR', password: 'SHOULD_NEVER_APPEAR' } });
  assert.ok(!lines[0]!.includes('SHOULD_NEVER_APPEAR')); assert.ok(!lines[0]!.includes('secret-data'));
});
test('idempotent replay rejects altered persisted output instead of trusting stale QA', async t => {
  const { service, adapter } = await fixture(t);
  const { artifacts } = await service.execute(request());
  const manifest = artifacts.manifests[0]!;
  await writeFile(path.join(adapter.outputRoot, artifacts.batch.batch_id, 'manifests', `${manifest.creative_id}.json`),
    JSON.stringify({ ...manifest, caption: 'Unverified alteration' }));
  await assert.rejects(service.execute(request()), /integrity mismatch/);
});
