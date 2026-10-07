import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = await mkdtemp(path.join(os.tmpdir(), 'marketing-os-ci-smoke-'));
function run(brand, key, expected) {
  const result = spawnSync(process.execPath, [path.join(repository, 'dist/src/cli/generate.js'), '--root', root,
    '--brand', brand, '--product', 'test-product', '--idempotency-key', key], { encoding: 'utf8' });
  assert.equal(result.status, expected, result.error?.message ?? result.stderr);
  if (expected === 3) {
    assert.equal(JSON.parse(result.stderr.trim()).error, 'STALE_INPUTS');
    assert.ok(!result.stdout.includes('READY_FOR_PRODUCTION'));
    return null;
  }
  return JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));
}
try {
  for (const folder of ['brands', 'products']) await cp(path.join(repository, folder), path.join(root, folder), { recursive: true });
  const grand = run('grand', 'ci-grand', 0);
  assert.equal(grand.status, 'READY_FOR_PRODUCTION');
  assert.equal(grand.variants_created, 18); assert.equal(grand.qa_counts.pass, 18);
  assert.equal(grand.idempotent_replay, false);
  console.log('PASS GRAND: exit 0, 18 variants, QA PASS 18');
  const replay = run('grand', 'ci-grand', 0);
  assert.equal(replay.idempotent_replay, true); assert.equal(replay.batch_id, grand.batch_id);
  console.log('PASS identical replay: exit 0, idempotent_replay=true');
  const safezone = run('safezone', 'ci-safezone', 2);
  assert.equal(safezone.compliance, 'REVIEW');
  assert.equal(safezone.status, 'BLOCKED'); assert.equal(safezone.variants_created, 0);
  console.log('PASS SafeZone: exit 2, REVIEW/BLOCKED, zero variants');
  const productFile = path.join(root, 'products/grand/test-product.json');
  const original = await readFile(productFile);
  try {
    const product = JSON.parse(original.toString('utf8')); product.product_version = 'ci-stale';
    await writeFile(productFile, `${JSON.stringify(product, null, 2)}\n`);
    run('grand', 'ci-grand', 3);
    console.log('PASS stale replay: exit 3, STALE_INPUTS');
  } finally { await writeFile(productFile, original); }
  assert.equal(run('grand', 'ci-grand', 0).idempotent_replay, true);
  console.log('PASS restored replay: exit 0');
} finally {
  const absolute = path.resolve(root), relative = path.relative(path.resolve(os.tmpdir()), absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !path.basename(absolute).startsWith('marketing-os-ci-smoke-')) {
    throw new Error('Unsafe smoke cleanup');
  }
  await rm(absolute, { recursive: true, force: true });
}
