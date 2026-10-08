import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Asset, Concept, assetFirst, pendingGates, reviewFingerprint, sampleBatch, scaleDecision} from '../src/creative-quality/director.ts';
const concepts = JSON.parse(readFileSync('creative-quality/concepts.json', 'utf8'));
const hash = 'a'.repeat(64);
const assets = concepts[0].required_assets.map((id: string) => ({id, kind: id === 'packshot' ? 'PACKSHOT' : 'CATEGORY_FOOTAGE',
  sha256: hash, source: 'TEST_FIXTURE / NOT_REAL_PRODUCT_DATA', rights: 'PEXELS', available: true, verified_bytes: true,
  width: 800, height: 800, product_id: null}));
test('creative quality: three specific sourced concepts; only two distinct samples allowed', () => {
  concepts.forEach((c: unknown) => Concept.parse(c));
  assert.equal(sampleBatch(concepts.slice(0, 2)).length, 2);
  assert.throws(() => sampleBatch(concepts), /EXACTLY_TWO/);
  assert.throws(() => sampleBatch([concepts[0], concepts[0]]), /DISTINCT_ART/);
});
test('creative quality: generic hook, ambiguous requirements and broken narrative are rejected', () => {
  assert.throws(() => Concept.parse({...concepts[0], hook: 'Conheça o produto'}), /GENERIC_CONCEPT/);
  assert.throws(() => Concept.parse({...concepts[0], required_assets: ['packshot', 'packshot']}), /DUPLICATE_ASSET/);
  const c = structuredClone(concepts[0]); c.narrative[1].at_s = 0;
  assert.throws(() => Concept.parse(c), /INVALID_NARRATIVE/);
});
test('creative quality: missing demo/macro cannot silently become drawings or slides', () => {
  assert.equal(assetFirst(concepts[0], assets).status, 'STUDY_ONLY');
  const c = structuredClone(concepts[0]); c.required_assets.push('real-grand-demo');
  assert.deepEqual(assetFirst(c, assets).reasons, ['MISSING_OR_UNVERIFIED_ASSET:real-grand-demo']);
  assert.ok(assetFirst(concepts[2], assets).reasons.includes('MISSING_OR_UNVERIFIED_ASSET:product-macro'));
});
test('creative quality: unverifiable bytes, unknown rights and duplicate assets block production', () => {
  assert.equal(assetFirst(concepts[0], assets.map((a: object) => ({...a, verified_bytes: false}))).status, 'BLOCKED');
  assert.equal(assetFirst(concepts[0], assets.map((a: object) => ({...a, rights: 'UNKNOWN'}))).status, 'BLOCKED');
  assert.throws(() => assetFirst(concepts[0], [...assets, assets[0]]), /DUPLICATE_ASSET_ID/);
  assert.throws(() => Asset.parse({...assets[0], secret: 'NOT_A_REAL_SECRET'}));
});
test('creative quality: stock action cannot serve as proof of a product benefit', () => {
  const c = {...concepts[1], scope: 'PRODUCT_STUDY'};
  assert.ok(assetFirst(c, []).reasons.includes('CATEGORY_ACTION_CANNOT_PROVE_PRODUCT_BENEFIT'));
});
test('creative quality: technical PASS never approves creative, brand, commerce or scale', () => {
  const gates = pendingGates(true);
  assert.equal(gates.TECHNICAL_QC.status, 'PASS');
  assert.equal(gates.HUMAN_APPROVAL.status, 'PENDING');
  assert.equal(scaleDecision(gates, hash).status, 'SCALE_SUSPENDED');
  assert.equal(pendingGates(false).TECHNICAL_QC.status, 'BLOCKED');
});
test('creative quality: every nontechnical approval needs reviewer, timestamp and exact fingerprint', () => {
  const gates = pendingGates(true);
  for (const r of Object.values(gates)) {r.status = 'PASS';}
  assert.equal(scaleDecision(gates, hash).status, 'SCALE_SUSPENDED');
  for (const r of Object.values(gates)) {r.reviewer = 'explicit-test-reviewer'; r.reviewed_at = '2026-10-08T12:00:00Z'; r.fingerprint = hash;}
  assert.equal(scaleDecision(gates, hash).status, 'ELIGIBLE_FOR_HUMAN_AUTHORIZED_SCALE');
  gates.HUMAN_APPROVAL.fingerprint = 'b'.repeat(64);
  assert.equal(scaleDecision(gates, hash).status, 'SCALE_SUSPENDED');
});
test('creative quality: approvals become stale after concept, source bytes or video changes', () => {
  const f = reviewFingerprint(concepts[0], assets, hash);
  assert.notEqual(f, reviewFingerprint({...concepts[0], cta: 'CTA changed'}, assets, hash));
  assert.notEqual(f, reviewFingerprint(concepts[0], assets.map((a: object) => ({...a, sha256: 'b'.repeat(64)})), hash));
  assert.notEqual(f, reviewFingerprint(concepts[0], assets, 'b'.repeat(64)));
});
