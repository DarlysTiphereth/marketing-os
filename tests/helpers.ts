import { cp, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { TestContext } from 'node:test';
import { AIUsageRecordSchema, AITaskSchema, BatchProductionRequestSchema, ProviderPricingSchema } from '../src/contracts/schemas.ts';
import type { BatchProductionRequest, ProviderPricing } from '../src/contracts/schemas.ts';
import { FilesystemRepositories, inside } from '../src/infrastructure/filesystem.ts';
import { GenerateBatch } from '../src/application/generate.ts';
import { StructuredLogger } from '../src/observability/logger.ts';
import { contentHash, uuid } from '../src/domain/identity.ts';
import { createMatrix, createStrategy, expandMatrix } from '../src/creative-factory/factory.ts';

export const NOW = '2026-10-05T00:00:00.000Z';
export function request(overrides: Partial<BatchProductionRequest> = {}): BatchProductionRequest {
  return BatchProductionRequestSchema.parse({ brand_id: 'grand', product_id: 'test-product', angles: 3,
    hooks_per_angle: 3, visual_variants: 2, platform: 'tiktok', format: 'VIDEO', production_tier_preference: 'TEMPLATE',
    budget_limit: 5, currency: 'BRL', idempotency_key: 'test-batch', ...overrides });
}
export async function fixture(t: TestContext) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'marketing-os-test-'));
  t.after(async () => {
    const absolute = path.resolve(root);
    if (!inside(path.resolve(os.tmpdir()), absolute) || !path.basename(absolute).startsWith('marketing-os-test-')) throw new Error('Unsafe test cleanup');
    await rm(absolute, { recursive: true, force: true });
  });
  await cp(path.resolve('brands'), path.join(root, 'brands'), { recursive: true });
  await cp(path.resolve('products'), path.join(root, 'products'), { recursive: true });
  const adapter = new FilesystemRepositories(root);
  const service = new GenerateBatch(adapter.repositories, new StructuredLogger(() => {}), adapter.outputRoot, () => NOW);
  return { root, adapter, service };
}
export async function planned(t: TestContext) {
  const f = await fixture(t);
  const brand = await f.adapter.repositories.brands.get('grand');
  const product = await f.adapter.repositories.products.get('grand', 'test-product');
  const req = request();
  const batchId = uuid(['batch', req.brand_id, req.idempotency_key]);
  const strategy = createStrategy(req, product, batchId, NOW);
  const matrix = createMatrix(req, strategy, batchId);
  const expansion = expandMatrix(matrix, brand, product, req, NOW);
  return { ...f, brand, product, req, batchId, strategy, matrix, ...expansion };
}
export function pricing(version = 'fixture-1', overrides: Partial<ProviderPricing> = {}): ProviderPricing {
  return ProviderPricingSchema.parse({ provider: 'test-provider', model: 'test-model', pricing_version: version,
    effective_from: NOW, input_unit_price: 1, cached_input_unit_price: 0.25, output_unit_price: 2,
    token_unit: 1000, media_unit: 'TEST_UNIT', media_unit_price: 0.5, currency: 'BRL',
    source_reference: { source_id: 'synthetic-price', source_type: 'TEST_FIXTURE', source_location: 'TEST_FIXTURE-NOT_REAL_PRICING',
      source_hash: contentHash('TEST_FIXTURE'), extracted_at: NOW }, ...overrides });
}
export function task(index = 0) {
  return AITaskSchema.parse({ task_id: uuid(['test-task', index]), task_type: 'HOOK', brand_id: 'grand', product_id: 'test-product',
    creative_id: null, complexity: 'LOW', quality_requirement: 'NORMAL', latency_requirement: 'BATCH', preferred_tier: 'CHEAP',
    max_cost: 1, cache_allowed: true, batch_allowed: true, structured_output_required: true, max_output_tokens: 128, created_at: NOW });
}
export function usage(index = 0) {
  return AIUsageRecordSchema.parse({ usage_id: uuid(['usage', index]), task_id: task(index).task_id, brand_id: 'grand', product_id: 'test-product',
    creative_id: uuid(['creative', index]), provider: 'TEST_FIXTURE', model: 'TEST_FIXTURE', model_tier: 'CHEAP',
    input_tokens: 100, cached_input_tokens: 25, output_tokens: 20, reasoning_tokens_if_available: null, estimated_cost: 0.1,
    actual_cost: null, currency: 'BRL', latency_ms: 10, cache_hit: false, batch_mode: false, status: 'SIMULATED',
    prompt_version: '1', skill_version: '1', created_at: NOW });
}
