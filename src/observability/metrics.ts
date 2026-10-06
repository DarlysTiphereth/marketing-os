import { AIUsageRecordSchema, EfficiencyReportSchema } from '../contracts/schemas.ts';
import type { AIUsageRecord, CostReport, CreativeVariant } from '../contracts/schemas.ts';

const rate = (numerator: number, denominator: number): number | null => denominator ? numerator / denominator : null;
export function tokenMetrics(rawRecords: AIUsageRecord[]) {
  const records = rawRecords.map(r => AIUsageRecordSchema.parse(r));
  const perTask: Record<string, number> = {}, perCreative: Record<string, number> = {};
  const perBrand: Record<string, number> = {}, perProduct: Record<string, number> = {};
  let input = 0, output = 0, cached = 0;
  for (const r of records) {
    // Provider adapters must normalize reasoning as a subset of output, preventing double counting.
    const tokens = r.input_tokens + r.output_tokens;
    input += r.input_tokens; output += r.output_tokens; cached += r.cached_input_tokens;
    perTask[r.task_id] = (perTask[r.task_id] ?? 0) + tokens;
    if (r.creative_id) perCreative[r.creative_id] = (perCreative[r.creative_id] ?? 0) + tokens;
    perBrand[r.brand_id] = (perBrand[r.brand_id] ?? 0) + tokens;
    const key = `${r.brand_id}/${r.product_id}`;
    perProduct[key] = (perProduct[key] ?? 0) + tokens;
  }
  return { tokens_input_total: input, tokens_output_total: output, tokens_cached_total: cached,
    tokens_per_task: perTask, tokens_per_creative: perCreative, tokens_per_brand: perBrand, tokens_per_product: perProduct,
    average_tokens_per_task: rate(Object.values(perTask).reduce((s, n) => s + n, 0), Object.keys(perTask).length),
    average_tokens_per_creative: rate(Object.values(perCreative).reduce((s, n) => s + n, 0), Object.keys(perCreative).length),
  };
}
export class ExecutionMetrics {
  private readonly tasks = new Set<string>();
  deterministic(taskId: string): void { this.tasks.add(taskId); }
  get count(): number { return this.tasks.size; }
}
export function efficiencyReport(input: { batchId: string; deterministicTasks: number; variants: CreativeVariant[];
  usage: AIUsageRecord[]; cacheHits: number; cacheMisses: number; assetsReused: number; assetsNew: number;
  duplicatesPrevented: number; cost: CostReport }) {
  const u = input.usage.map(r => AIUsageRecordSchema.parse(r));
  const tokens = tokenMetrics(u);
  const aiTasks = new Set(u.map(r => r.task_id)).size;
  const total = input.deterministicTasks + aiTasks;
  const count = (tier: AIUsageRecord['model_tier']) => u.filter(r => r.model_tier === tier).length;
  const media = (tier: CreativeVariant['production_tier']) => input.variants.filter(v => v.production_tier === tier).length;
  return EfficiencyReportSchema.parse({
    batch_id: input.batchId, tasks_total: total, deterministic_tasks: input.deterministicTasks, ai_tasks: aiTasks,
    cache_hits: input.cacheHits, cache_misses: input.cacheMisses, assets_reused: input.assetsReused, assets_new: input.assetsNew,
    duplicates_prevented: input.duplicatesPrevented, input_tokens: tokens.tokens_input_total,
    output_tokens: tokens.tokens_output_total, cached_tokens: tokens.tokens_cached_total,
    cheap_tasks: count('CHEAP'), standard_tasks: count('STANDARD'), premium_tasks: count('PREMIUM'),
    template_media: media('TEMPLATE'), hybrid_media: media('HYBRID'), premium_media: media('PREMIUM'),
    estimated_savings_from_cache: 'NOT_CALCULABLE_YET', estimated_savings_from_reuse: 'NOT_CALCULABLE_YET',
    estimated_savings_from_deduplication: 'NOT_CALCULABLE_YET', savings_from_model_routing: 'NOT_CALCULABLE_YET',
    savings_from_deterministic_execution: 'NOT_CALCULABLE_YET',
    cache_hit_rate: rate(input.cacheHits, input.cacheHits + input.cacheMisses),
    asset_reuse_rate: rate(input.assetsReused, input.assetsReused + input.assetsNew),
    deterministic_task_rate: rate(input.deterministicTasks, total), cheap_model_rate: rate(count('CHEAP'), u.length),
    standard_model_rate: rate(count('STANDARD'), u.length), premium_model_rate: rate(count('PREMIUM'), u.length),
    template_media_rate: rate(media('TEMPLATE'), input.variants.length), hybrid_media_rate: rate(media('HYBRID'), input.variants.length),
    premium_media_rate: rate(media('PREMIUM'), input.variants.length), average_tokens_per_task: tokens.average_tokens_per_task,
    average_cost_per_task: rate(input.cost.estimated_total, total), average_cost_per_creative: rate(input.cost.estimated_total, input.variants.length),
    budget_warning_count: input.cost.budget_status === 'WARN' ? 1 : 0,
    budget_block_count: input.cost.budget_status === 'BUDGET_BLOCKED' ? 1 : 0,
  });
}
