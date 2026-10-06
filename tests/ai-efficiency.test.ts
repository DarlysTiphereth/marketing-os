import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { AIUsageRecordSchema, EfficiencyReportSchema } from '../src/contracts/schemas.ts';
import type { ModelRouteInput } from '../src/contracts/ports.ts';
import { ContextBuilder } from '../src/ai/context.ts';
import { DEFAULT_PROMPTS, enforceOutputBudget } from '../src/ai/prompts.ts';
import { cacheKey, MemoryCache, VersionedCache } from '../src/ai/cache.ts';
import { prepareBatch, validateBatchResults } from '../src/ai/batching.ts';
import { CheapFirstModelRouter } from '../src/ai/routing.ts';
import { AIUsageLedger } from '../src/ai/usage-ledger.ts';
import { tokenMetrics } from '../src/observability/metrics.ts';
import { fixture, NOW, planned, pricing, request, task, usage } from './helpers.ts';

const keyInput = { task_type: 'HOOK', normalized_input: { name: 'TEST_FIXTURE', locale: 'pt-BR' },
  brand_id: 'grand', product_id: 'test-product', brand_version: 'fixture-1', product_version: 'fixture-1',
  prompt_version: '1', skill_version: '1', model_family: 'TEST_FIXTURE' };
test('18 ContextBuilder minimal context excludes irrelevant brand brain, warnings, assets and timestamps', async t => {
  const { brand, product } = await planned(t);
  const builder = new ContextBuilder();
  const context = builder.build('MINIMAL', brand, product);
  for (const field of ['warnings', 'assets', 'visual_rules', 'prohibited_patterns', 'tone_of_voice', 'created_at', 'source_references']) {
    assert.equal(field in context, false, field);
  }
  assert.ok('official_description' in context);
  assert.ok(JSON.stringify(context).length < JSON.stringify({ brand, product }).length);
  assert.throws(() => builder.build('MINIMAL', { ...brand, brand_id: 'safezone' }, product), /mismatch/);
});
test('19 output token budget is enforced against both task and prompt limits', () => {
  const t = task(); const prompt = DEFAULT_PROMPTS.get('HOOK', '1');
  enforceOutputBudget(t, prompt, 128);
  assert.throws(() => enforceOutputBudget(t, prompt, 129), /budget exceeded/);
  assert.throws(() => enforceOutputBudget({ ...t, max_output_tokens: 32 }, prompt, 33), /budget exceeded/);
  assert.throws(() => DEFAULT_PROMPTS.get('HOOK', 'missing'), /not found/);
});
test('20 cache hit exposes key and creation time across filesystem adapter instances', async t => {
  const { adapter } = await fixture(t);
  const cache = new VersionedCache(adapter.cache);
  assert.equal((await cache.get(keyInput)).cache_hit, false);
  await cache.put(keyInput, { hook: 'TEST_FIXTURE' }, NOW);
  const entry = await new VersionedCache(adapter.cache).get(keyInput);
  assert.equal(entry.cache_hit, true); assert.equal(entry.cache_created_at, NOW);
  assert.deepEqual(entry.value, { hook: 'TEST_FIXTURE' }); assert.equal(entry.cache_key, cacheKey(keyInput));
});
test('21 cache invalidates each relevant version and tenant identity; normalized key order is stable', async () => {
  const cache = new VersionedCache(new MemoryCache()); await cache.put(keyInput, { hook: 'TEST_FIXTURE' }, NOW);
  for (const field of ['brand_version', 'product_version', 'prompt_version', 'skill_version', 'model_family', 'brand_id', 'product_id']) {
    assert.equal((await cache.get({ ...keyInput, [field]: 'changed' })).cache_hit, false, field);
  }
  assert.equal(cacheKey(keyInput), cacheKey({ ...keyInput, normalized_input: { locale: 'pt-BR', name: 'TEST_FIXTURE' } }));
});
test('22 structured batching keeps 20 individual IDs and rejects duplicates/missing results and cross-brand groups', () => {
  const tasks = Array.from({ length: 20 }, (_, i) => task(i));
  const batch = prepareBatch(tasks, '1'); assert.equal(batch.max_output_tokens, 2688);
  const results = tasks.map(t => ({ task_id: t.task_id, result: { hook: 'TEST_FIXTURE' } }));
  assert.equal(validateBatchResults(batch, results, z.object({ hook: z.string() }).strict()).length, 20);
  assert.throws(() => validateBatchResults(batch, results.slice(1), z.unknown()), /Incomplete/);
  assert.throws(() => prepareBatch([task(), task()], '1'), /Duplicate task/);
  assert.throws(() => prepareBatch([task(), { ...task(1), brand_id: 'safezone' }], '1'), /Unsafe/);
  assert.throws(() => prepareBatch(tasks, '1', 1000), /budget exceeded/);
  assert.throws(() => prepareBatch(tasks, '1', NaN), /Invalid batch budget/);
});
function router() {
  return new CheapFirstModelRouter(['CHEAP', 'STANDARD', 'PREMIUM'].map((tier, i) => ({
    provider: 'test-provider', model: `test-model-${tier.toLowerCase()}`, tier: tier as 'CHEAP' | 'STANDARD' | 'PREMIUM',
    max_context_tokens: 8000, batch_supported: true, pricing: pricing('fixture-1', { model: `test-model-${tier.toLowerCase()}`, input_unit_price: (i + 1) * 0.1,
      output_unit_price: (i + 1) * 0.2 }),
  })));
}
const routeInput: ModelRouteInput = { task_type: 'HOOK', complexity: 'HIGH', quality_requirement: 'HIGH', latency_requirement: 'BATCH',
  context_size: 100, max_cost: 1, currency: 'BRL', failed_tiers: [], premium_justification: null, premium_allowed: false };
test('25 cheap-first routing even for high complexity; model must fit context and task cost', () => {
  assert.equal(router().route(routeInput).tier, 'CHEAP');
  assert.throws(() => router().route({ ...routeInput, max_cost: 0 }), /within budget/);
  assert.throws(() => router().route({ ...routeInput, context_size: 10000 }), /eligible model/);
  assert.throws(() => router().route({ ...routeInput, currency: 'USD' }), /eligible model/);
  assert.throws(() => new CheapFirstModelRouter([{ provider: 'test-provider', model: 'mismatched-model', tier: 'CHEAP',
    max_context_tokens: 8000, batch_supported: true, pricing: pricing() }]), /identity/);
});
test('26 premium escalation requires failed cheaper tiers, allowed budget and business justification', () => {
  assert.equal(router().route({ ...routeInput, failed_tiers: ['CHEAP'] }).tier, 'STANDARD');
  assert.throws(() => router().route({ ...routeInput, failed_tiers: ['CHEAP', 'STANDARD'] }), /not justified/);
  assert.equal(router().route({ ...routeInput, failed_tiers: ['CHEAP', 'STANDARD'], premium_allowed: true,
    premium_justification: 'TEST_FIXTURE business justification' }).tier, 'PREMIUM');
  assert.equal(router().route({ ...routeInput, premium_allowed: true, premium_justification: 'optional' }).tier, 'CHEAP');
});
test('27 AIUsageRecord ledger validates values, labels simulations, isolates brands and prevents duplicate usage', () => {
  const ledger = new AIUsageLedger(); ledger.append(usage());
  assert.equal(ledger.list('grand', 'test-product')[0]!.status, 'SIMULATED');
  assert.equal(ledger.list('safezone', 'test-product').length, 0);
  assert.throws(() => ledger.append(usage()), /Duplicate/);
  assert.equal(AIUsageRecordSchema.safeParse({ ...usage(), cached_input_tokens: 101 }).success, false);
});
test('28 token metrics aggregate task/creative/brand/product without doubling cached or reasoning tokens', () => {
  const records = [usage(), { ...usage(1), reasoning_tokens_if_available: 5 }];
  const result = tokenMetrics(records);
  assert.equal(result.tokens_input_total, 200); assert.equal(result.tokens_output_total, 40); assert.equal(result.tokens_cached_total, 50);
  assert.equal(result.tokens_per_brand.grand, 240); assert.equal(result.tokens_per_product['grand/test-product'], 240);
  assert.equal(result.average_tokens_per_task, 120); assert.equal(result.average_tokens_per_creative, 120);
});
test('30 EfficiencyReport uses real operation counters and unavailable savings/empty denominator rates', async t => {
  const { service } = await fixture(t);
  const { artifacts } = await service.execute(request());
  const e = EfficiencyReportSchema.parse(artifacts.efficiency);
  assert.equal(e.ai_tasks, 0); assert.equal(e.input_tokens, 0); assert.equal(e.output_tokens, 0);
  assert.equal(e.assets_reused, 18); assert.equal(e.template_media, 18); assert.equal(e.template_media_rate, 1);
  assert.equal(e.premium_model_rate, null); assert.equal(e.cache_hit_rate, null); assert.equal(e.deterministic_task_rate, 1);
  assert.equal(e.estimated_savings_from_cache, 'NOT_CALCULABLE_YET'); assert.ok(e.deterministic_tasks > 18);
});
