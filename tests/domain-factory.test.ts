import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { CreativeVariantSchema, ProductionManifestSchema } from '../src/contracts/schemas.ts';
import { assertSupportedClaim, validateProvenance } from '../src/domain/product.ts';
import { transition } from '../src/domain/status.ts';
import { AssetRegistry } from '../src/domain/assets.ts';
import { createManifest, expandMatrix } from '../src/creative-factory/factory.ts';
import { compliancePrecheck } from '../src/compliance/policy.ts';
import { fixture, NOW, planned, request } from './helpers.ts';

test('01 BrandContext loading', async t => {
  const { adapter } = await fixture(t);
  const brand = await adapter.repositories.brands.get('grand');
  assert.equal(brand.name, 'GRAND Limpeza & Proteção'); assert.equal(brand.data_label, 'TEST_FIXTURE');
});
test('02 ProductKnowledge loading and evidence verification', async t => {
  const { adapter } = await fixture(t);
  const product = await adapter.repositories.products.get('grand', 'test-product');
  await validateProvenance(product, adapter.repositories.sources);
  assert.equal(product.knowledge_status, 'TEST_FIXTURE'); assert.match(product.data_notice, /NOT_REAL_PRODUCT_DATA/);
});
test('03 nonexistent product rejection', async t => {
  const { service } = await fixture(t);
  await assert.rejects(service.execute(request({ product_id: 'nonexistent' })), /ENOENT/);
});
test('04 unsupported claim rejection', async t => {
  const { product } = await planned(t);
  assert.throws(() => assertSupportedClaim({ text: 'Resultado garantido em um dia', source_ids: ['test-evidence'] }, product), /Unsupported/);
  assert.throws(() => assertSupportedClaim({ text: product.official_description!.text, source_ids: ['absent'] }, product), /NO SOURCE/);
});
test('05 valid state transition', async t => {
  const { variants } = await planned(t);
  const result = transition(transition(transition(variants[0]!, 'PLANNED', NOW), 'QA_REVIEW', NOW), 'READY_FOR_PRODUCTION', NOW);
  assert.equal(result.status, 'READY_FOR_PRODUCTION'); assert.equal(variants[0]!.status, 'DRAFT');
});
test('06 invalid state transition', async t => {
  const { variants } = await planned(t);
  assert.throws(() => transition(variants[0]!, 'READY_FOR_PRODUCTION', NOW), /Invalid transition/);
});
test('07 3x3x2 = 18 deterministic unique variants and decision references', async t => {
  const p = await planned(t);
  assert.equal(p.variants.length, 18); assert.equal(new Set(p.variants.map(v => v.creative_id)).size, 18);
  assert.deepEqual(expandMatrix(p.matrix, p.brand, p.product, p.req, NOW).variants, p.variants);
  for (const v of p.variants) { CreativeVariantSchema.parse(v); assert.ok(p.strategy.hypotheses.some(h => h.hypothesis_id === v.hypothesis_id)); }
  const ambiguous = structuredClone(p.matrix);
  ambiguous.angles.push({ ...ambiguous.angles[0]!, label: 'Conflicting decision' });
  assert.throws(() => expandMatrix(ambiguous, p.brand, p.product, p.req, NOW), /Ambiguous/);
});
test('08 duplicate prevention compares semantics and records count', async t => {
  const p = await planned(t);
  p.matrix.visuals.push({ ...p.matrix.visuals[0]!, visual_variant_id: 'alias-visual' });
  const result = expandMatrix(p.matrix, p.brand, p.product, p.req, NOW);
  assert.equal(result.variants.length, 18); assert.equal(result.duplicates_prevented, 9);
});
test('09 human creative_code is unique and identity is UUID', async t => {
  const { variants } = await planned(t);
  assert.equal(new Set(variants.map(v => v.creative_code)).size, 18);
  assert.match(variants[0]!.creative_code, /^GRAND-TEST-PRODUCT-BR-TIKTOK-VID-DNA001-[A-F0-9]{8}-V001$/);
});
test('10 production manifest validity, faceless and 18-second timeline', async t => {
  const p = await planned(t);
  const m = ProductionManifestSchema.parse(createManifest(p.variants[0]!, p.matrix, p.product, p.product.assets));
  assert.equal(m.faceless_required, true); assert.equal(m.shot_list.reduce((n, s) => n + s.duration_seconds, 0), 18);
  assert.ok(m.script.includes('NOT_REAL_PRODUCT_DATA')); assert.equal(m.image_prompts.length, 0);
});
test('11 GRAND/SafeZone isolation across product, asset, context and outputs', async t => {
  const { adapter, service } = await fixture(t);
  const grand = await service.execute(request());
  const safe = await service.execute(request({ brand_id: 'safezone' }));
  assert.notEqual(grand.artifacts.batch.batch_id, safe.artifacts.batch.batch_id);
  assert.equal(safe.artifacts.product.brand_id, 'safezone'); assert.equal(safe.artifacts.variants.length, 0);
  assert.ok(!JSON.stringify(safe.artifacts).includes('grand-test-template'));
  const assets = await adapter.repositories.assets.list('safezone', 'test-product');
  assert.ok(assets.every(a => a.brand_id === 'safezone'));
});
test('12 SafeZone REVIEW halts generation before strategy/matrix/media work', async t => {
  const { service } = await fixture(t);
  const { artifacts } = await service.execute(request({ brand_id: 'safezone' }));
  assert.equal(artifacts.compliance.decision, 'REVIEW'); assert.equal(artifacts.qa.status, 'REVIEW');
  assert.equal(artifacts.batch.status, 'BLOCKED'); assert.equal(artifacts.manifests.length, 0);
  assert.equal(artifacts.strategy.hypotheses.length, 0); assert.equal(artifacts.matrix.state, 'WITHHELD');
});
test('13 SafeZone BLOCK for restricted category; brand-profile changes cannot bypass it', async t => {
  const { adapter } = await fixture(t);
  const brand = await adapter.repositories.brands.get('safezone');
  const product = await adapter.repositories.products.get('safezone', 'test-product');
  product.category = 'TOBACCO';
  assert.equal(compliancePrecheck(brand, product, request({ brand_id: 'safezone' }), NOW).decision, 'BLOCK');
  brand.compliance_profile = 'GENERAL'; product.category = 'UNKNOWN';
  assert.equal(compliancePrecheck(brand, product, request({ brand_id: 'safezone' }), NOW).decision, 'REVIEW');
});
test('23 AssetRegistry lookup filters by brand, product and faceless evidence', async t => {
  const { adapter } = await fixture(t);
  const records = await adapter.repositories.assets.list('grand', 'test-product');
  const registry = new AssetRegistry(records);
  assert.equal(registry.lookup('grand', 'test-product', 'TEMPLATE').length, 1);
  assert.equal(registry.lookup('safezone', 'test-product', 'TEMPLATE').length, 0);
  assert.throws(() => registry.reuse(records[0]!.asset_id, 'safezone', 'test-product'), /another brand/);
});
test('24 asset reuse count appears in persisted batch registry', async t => {
  const { service, adapter } = await fixture(t);
  const { artifacts } = await service.execute(request());
  assert.equal(artifacts.assets[0]!.usage_count, 18);
  assert.equal((await adapter.load(artifacts.batch.batch_id)).assets[0]!.usage_count, 18);
});
test('source tampering and mislabeled real data fail before generation', async t => {
  const { adapter, root } = await fixture(t);
  const product = await adapter.repositories.products.get('grand', 'test-product');
  product.data_label = 'REAL_DATA';
  await assert.rejects(validateProvenance(product, adapter.repositories.sources), /test fixtures/);
  product.data_label = 'TEST_FIXTURE';
  const source = path.join(root, product.source_references[0]!.source_location);
  await writeFile(source, `${await readFile(source, 'utf8')} `);
  await assert.rejects(validateProvenance(product, adapter.repositories.sources), /hash mismatch/);
});
