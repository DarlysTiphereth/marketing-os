import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CostReportSchema } from '../src/contracts/schemas.ts';
import type { BudgetPolicy } from '../src/contracts/schemas.ts';
import { CostEstimator, CostRouter, evaluateBudget } from '../src/cost/controls.ts';
import { fixture, pricing, request } from './helpers.ts';

const policy: BudgetPolicy = { scope: 'BRAND', scope_id: 'grand', period: 'MONTH', soft_limit: 4,
  hard_limit: 5, currency: 'BRL', warning_threshold: 0.8, premium_allowed: true };
test('14 CostEstimator uses versioned token/media pricing, including cached input', () => {
  const result = new CostEstimator().estimate({ estimated_input_tokens: 1000, estimated_cached_input_tokens: 200,
    estimated_output_tokens: 100, estimated_media_units: 2, currency: 'BRL' }, pricing());
  assert.equal(result.estimated_llm_cost, 1.05); assert.equal(result.estimated_media_cost, 1);
  assert.equal(result.estimated_total_cost, 2.05); assert.equal(result.pricing_version, 'fixture-1');
});
test('15 hard budget block uses spend + estimate before paid execution', () => {
  assert.equal(evaluateBudget(policy, 3, 2.01, 'BRL').status, 'BUDGET_BLOCKED');
  assert.notEqual(evaluateBudget(policy, 3, 2, 'BRL').status, 'BUDGET_BLOCKED');
  assert.equal(evaluateBudget(policy, 5, 1e-10, 'BRL').status, 'BUDGET_BLOCKED');
  assert.throws(() => new CostRouter().route({ reusable: false, deterministic: false, cache_hit: false,
    cheap_sufficient: true, standard_sufficient: true, premium_justification: null,
    policy, actual_spend: 3, estimated_cost: 3, currency: 'BRL' }), /BUDGET_BLOCKED/);
});
test('16 soft budget warning restricts premium and prefers reuse/cache/cheap', () => {
  const result = evaluateBudget(policy, 3, 1, 'BRL');
  assert.equal(result.status, 'WARN'); assert.equal(result.premium_allowed, false);
  assert.deepEqual(result.preferred_actions, ['REUSE', 'CACHE', 'CHEAP']);
});
test('17 ProviderPricing versioning reads requested immutable version', async t => {
  const { adapter, root } = await fixture(t);
  const directory = path.join(root, 'pricing/test-provider/test-model'); await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'fixture-1.json'), JSON.stringify(pricing()));
  await writeFile(path.join(directory, 'fixture-2.json'), JSON.stringify(pricing('fixture-2', { output_unit_price: 4 })));
  assert.equal((await adapter.repositories.pricing.get('test-provider', 'test-model', 'fixture-1')).output_unit_price, 2);
  assert.equal((await adapter.repositories.pricing.get('test-provider', 'test-model', 'fixture-2')).output_unit_price, 4);
});
test('29 CostReport distinguishes zero planning cost from unknown future media and actual cost', async t => {
  const { service } = await fixture(t);
  const { artifacts } = await service.execute(request());
  const report = CostReportSchema.parse(artifacts.cost);
  assert.equal(report.estimated_total, 0); assert.equal(report.budget_remaining, 5);
  assert.equal(report.estimate_scope, 'V0_1_PLANNING_ONLY'); assert.equal(report.future_media_cost, 'NOT_AVAILABLE_YET');
  assert.equal(report.actual_total_if_available, 'NOT_AVAILABLE_YET');
});
test('cost controls reject negative/NaN amounts, incompatible currencies and invalid cache estimates', () => {
  assert.throws(() => evaluateBudget(policy, -1, 0, 'BRL'), /Invalid budget/);
  assert.throws(() => evaluateBudget(policy, 0, NaN, 'BRL'), /Invalid budget/);
  assert.throws(() => evaluateBudget(policy, 0, 1, 'USD'), /currency/);
  assert.throws(() => new CostEstimator().estimate({ estimated_input_tokens: 1, estimated_cached_input_tokens: 2,
    estimated_output_tokens: 0, estimated_media_units: 0, currency: 'BRL' }, pricing()), /Cached tokens/);
});
test('CostRouter follows reuse -> code -> cache -> cheap; premium requires explicit justification', () => {
  const input = { reusable: true, deterministic: true, cache_hit: true, cheap_sufficient: true, standard_sufficient: true,
    premium_justification: null, policy, actual_spend: 0, estimated_cost: 0, currency: 'BRL' as const };
  const router = new CostRouter();
  assert.equal(router.route(input).action, 'REUSE');
  assert.equal(router.route({ ...input, reusable: false }).action, 'CODE');
  assert.equal(router.route({ ...input, reusable: false, deterministic: false }).action, 'CACHE');
  assert.equal(router.route({ ...input, reusable: false, deterministic: false, cache_hit: false }).class, 'CHEAP');
  assert.throws(() => router.route({ ...input, reusable: false, deterministic: false, cache_hit: false,
    cheap_sufficient: false, standard_sufficient: false }), /Premium requires/);
});
