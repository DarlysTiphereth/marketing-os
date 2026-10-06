import { z } from 'zod';

export const Text = z.string().trim().min(1);
export const Slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
export const UUID = z.string().uuid();
export const Timestamp = z.string().datetime();
export const Money = z.number().finite().nonnegative();
export const Count = z.number().int().nonnegative();
export const Hash = z.string().regex(/^[a-f0-9]{64}$/);
export const Currency = z.enum(['BRL', 'USD', 'EUR']);
export const Tier = z.enum(['TEMPLATE', 'HYBRID', 'PREMIUM']);
export const ModelTier = z.enum(['CHEAP', 'STANDARD', 'PREMIUM']);
export const Status = z.enum(['DRAFT', 'PLANNED', 'QA_REVIEW', 'READY_FOR_PRODUCTION', 'BLOCKED']);
const DataLabel = z.enum(['REAL_DATA', 'TEST_FIXTURE']);
const UnknownNumber = z.union([Money, z.literal('NOT_AVAILABLE_YET')]);
const Savings = z.union([Money, z.literal('NOT_CALCULABLE_YET')]);

export const SourceReferenceSchema = z.object({
  source_id: Slug, source_type: z.enum(['OFFICIAL', 'MANUAL', 'TEST_FIXTURE']),
  source_location: Text, source_hash: Hash, extracted_at: Timestamp,
}).strict();
export const SourcedFactSchema = z.object({ text: Text, source_ids: z.array(Slug).min(1) }).strict();
export const BrandContextSchema = z.object({
  brand_id: Slug, name: Text, brand_version: Text, default_locale: Text, default_market: Text,
  tone_of_voice: z.array(Text), visual_rules: z.array(Text), content_rules: z.array(Text),
  prohibited_patterns: z.array(Text), compliance_profile: z.enum(['GENERAL', 'REGULATED_CONSERVATIVE']),
  data_label: DataLabel, data_notice: Text, created_at: Timestamp, updated_at: Timestamp,
}).strict();
export const ProductKnowledgeSchema = z.object({
  product_id: Slug, brand_id: Slug, product_version: Text, name: Text, category: Text,
  variant: Text, volume: Text, official_description: SourcedFactSchema.nullable(),
  confirmed_features: z.array(SourcedFactSchema), confirmed_benefits: z.array(SourcedFactSchema),
  usage_instructions: z.array(SourcedFactSchema), warnings: z.array(SourcedFactSchema),
  prohibited_claims: z.array(Text), assets: z.array(Slug), source_references: z.array(SourceReferenceSchema),
  knowledge_status: z.enum(['VERIFIED', 'INCOMPLETE', 'TEST_FIXTURE']), missing_information: z.array(Text),
  data_label: DataLabel, data_notice: Text, created_at: Timestamp, updated_at: Timestamp,
}).strict();
export const CreativeHypothesisSchema = z.object({
  hypothesis_id: UUID, brand_id: Slug, product_id: Slug, objective: Text,
  angle: Text, audience_problem: Text, promise: Text, proof_available: z.array(Slug),
  hook_strategy: Text, format: Text, platform: Text, duration_target: z.number().positive(),
  cta_strategy: Text, reasoning_summary: Text, strategy_version: Text, created_at: Timestamp,
}).strict();
export const CreativeDNASchema = z.object({
  dna_id: Slug, version: Text, hook_type: Text, narrative_structure: Text, visual_style: Text,
  pacing: Text, product_reveal_timing: Text, duration_range: z.tuple([z.number().positive(), z.number().positive()]),
  caption_style: Text, audio_style: Text, cta_style: Text,
}).strict();
export const BatchProductionRequestSchema = z.object({
  brand_id: Slug, product_id: Slug, angles: z.number().int().min(1).max(3),
  hooks_per_angle: z.number().int().min(1).max(3), visual_variants: z.number().int().min(1).max(2),
  platform: z.enum(['tiktok', 'instagram', 'youtube']), format: z.literal('VIDEO'),
  production_tier_preference: Tier, budget_limit: Money, currency: Currency,
  idempotency_key: Text.max(200),
}).strict();
export const GenerationMatrixSchema = z.object({
  batch_id: UUID, template_version: Text, state: z.enum(['PLANNED', 'WITHHELD']),
  angles: z.array(z.object({ angle_id: Slug, hypothesis_id: UUID, label: Text }).strict()),
  hooks: z.array(z.object({ hook_id: Slug, angle_id: Slug, text: Text }).strict()),
  visuals: z.array(z.object({ visual_variant_id: Slug, execution: z.enum(['PRODUCT_ONLY', 'KINETIC_TYPOGRAPHY']) }).strict()),
}).strict();
export const CostBreakdownSchema = z.object({
  strategy_cost: Money, copy_cost: Money, image_cost: Money, video_cost: Money,
  tts_cost: Money, render_cost: Money, distribution_cost: Money, total_cost: Money,
}).strict();
export const CreativeVariantSchema = z.object({
  creative_id: UUID, creative_code: Text, brand_id: Slug, product_id: Slug, batch_id: UUID,
  market: Text, locale: Text, platform: Text, format: Text, angle_id: Slug, hook_id: Slug,
  visual_variant_id: Slug, dna_id: Slug, hypothesis_id: UUID, production_tier: Tier,
  experiment_id: UUID, status: Status, brand_version: Text, product_version: Text,
  strategy_version: Text, creative_dna_version: Text, template_version: Text, prompt_version: Text,
  estimated_cost: Money, actual_cost: Money.nullable(), cost_breakdown: CostBreakdownSchema,
  created_at: Timestamp, updated_at: Timestamp,
}).strict();
export const OutputSpecsSchema = z.object({
  aspect_ratio: z.literal('9:16'), resolution: z.literal('1080x1920'), duration_target: z.number().positive(),
  fps: z.number().int().positive(), subtitle_required: z.boolean(), audio_required: z.boolean(),
}).strict();
export const ProductionManifestSchema = z.object({
  creative_id: UUID, script: Text,
  shot_list: z.array(z.object({ shot_id: Slug, description: Text, duration_seconds: z.number().positive(),
    identifiable_face: z.literal(false) }).strict()).min(1),
  image_prompts: z.array(Text), video_prompts: z.array(Text), voiceover_text: z.string(),
  on_screen_text: z.array(Text).min(1), caption: Text, cta: Text, required_assets: z.array(Slug).min(1),
  faceless_required: z.literal(true), production_tier: Tier, output_specs: OutputSpecsSchema,
  cost_estimate: CostBreakdownSchema, claims: z.array(SourcedFactSchema),
  data_label: DataLabel, data_notice: Text, template_version: Text,
}).strict();
export const AssetRecordSchema = z.object({
  asset_id: Slug, brand_id: Slug, product_id: Slug, asset_type: z.enum(['TEMPLATE', 'IMAGE', 'VIDEO', 'AUDIO']),
  source: Text, content_hash: Hash, version: Text, usage_count: Count, created_at: Timestamp,
  faceless_verified: z.boolean(), data_label: DataLabel,
}).strict();
export const AssetRegistrySchema = z.object({ assets: z.array(AssetRecordSchema) }).strict();
export const AITaskSchema = z.object({
  task_id: UUID, task_type: z.enum(['CLASSIFICATION', 'HOOK', 'CAPTION', 'SCRIPT', 'STRATEGY', 'DEEP_ANALYSIS']),
  brand_id: Slug, product_id: Slug, creative_id: UUID.nullable(),
  complexity: z.enum(['LOW', 'MEDIUM', 'HIGH']), quality_requirement: z.enum(['NORMAL', 'HIGH']),
  latency_requirement: z.enum(['INTERACTIVE', 'BATCH']), preferred_tier: ModelTier,
  max_cost: Money, cache_allowed: z.boolean(), batch_allowed: z.boolean(), structured_output_required: z.literal(true),
  max_output_tokens: z.number().int().positive(), created_at: Timestamp,
}).strict();
export const PromptTemplateSchema = z.object({
  prompt_template_id: Slug, name: Text, task_type: AITaskSchema.shape.task_type, version: Text,
  static_instructions: Text, expected_schema: z.record(z.unknown()), max_output_tokens: z.number().int().positive(),
  created_at: Timestamp,
}).strict();
export const CacheMetadataSchema = z.object({ cache_hit: z.boolean(), cache_key: Hash, cache_created_at: Timestamp.nullable() }).strict();
export const AIUsageRecordSchema = z.object({
  usage_id: UUID, task_id: UUID, brand_id: Slug, product_id: Slug, creative_id: UUID.nullable(),
  provider: Text, model: Text, model_tier: ModelTier, input_tokens: Count, cached_input_tokens: Count,
  output_tokens: Count, reasoning_tokens_if_available: Count.nullable(), estimated_cost: Money,
  actual_cost: Money.nullable(), currency: Currency, latency_ms: Money, cache_hit: z.boolean(), batch_mode: z.boolean(),
  status: z.enum(['SUCCESS', 'FAILED', 'SIMULATED']), prompt_version: Text, skill_version: Text, created_at: Timestamp,
}).strict().superRefine((record, ctx) => {
  if (record.cached_input_tokens > record.input_tokens) ctx.addIssue({ code: 'custom', message: 'Cached tokens exceed input tokens' });
  if ((record.reasoning_tokens_if_available ?? 0) > record.output_tokens) ctx.addIssue({ code: 'custom', message: 'Reasoning tokens must be normalized as a subset of output' });
});
export const ProviderPricingSchema = z.object({
  provider: Text, model: Text, pricing_version: Text, effective_from: Timestamp,
  input_unit_price: Money, cached_input_unit_price: Money, output_unit_price: Money,
  token_unit: z.number().int().positive(), media_unit: Text, media_unit_price: Money,
  currency: Currency, source_reference: SourceReferenceSchema,
}).strict();
export const BudgetPolicySchema = z.object({
  scope: z.enum(['GLOBAL', 'BRAND', 'PRODUCT', 'CAMPAIGN', 'EXPERIMENT']), scope_id: Text,
  period: Text, soft_limit: Money, hard_limit: Money, currency: Currency,
  warning_threshold: z.number().min(0).max(1), premium_allowed: z.boolean(),
}).strict().refine(p => p.soft_limit <= p.hard_limit, 'Soft limit must not exceed hard limit');
export const ComplianceDecisionSchema = z.object({
  brand_id: Slug, product_id: Slug, market: Text, platform: Text, content_type: Text,
  stage: z.enum(['PRE_GENERATION', 'PRE_PUBLICATION']), decision: z.enum(['ALLOW', 'REVIEW', 'BLOCK']),
  reason: Text, policy_version: Text, checked_at: Timestamp,
}).strict();
export const QAReportSchema = z.object({
  batch_id: UUID, checked_at: Timestamp, status: z.enum(['PASS', 'REVIEW', 'FAIL']),
  reports: z.array(z.object({ creative_id: UUID, status: z.enum(['PASS', 'REVIEW', 'FAIL']), issues: z.array(Text) }).strict()),
  pass: Count, review: Count, fail: Count,
}).strict();
export const CostReportSchema = z.object({
  batch_id: UUID, currency: Currency, estimated_llm_cost: Money, estimated_image_cost: Money,
  estimated_video_cost: Money, estimated_tts_cost: Money, estimated_render_cost: Money, estimated_total: Money,
  actual_total_if_available: UnknownNumber, budget_limit: Money, budget_remaining: z.number().finite(), pricing_version: Text,
  budget_status: z.enum(['OK', 'WARN', 'BUDGET_BLOCKED']), estimate_scope: z.literal('V0_1_PLANNING_ONLY'),
  future_media_cost: z.literal('NOT_AVAILABLE_YET'),
}).strict();
export const EfficiencyReportSchema = z.object({
  batch_id: UUID, tasks_total: Count, deterministic_tasks: Count, ai_tasks: Count,
  cache_hits: Count, cache_misses: Count, assets_reused: Count, assets_new: Count, duplicates_prevented: Count,
  input_tokens: Count, output_tokens: Count, cached_tokens: Count, cheap_tasks: Count, standard_tasks: Count, premium_tasks: Count,
  template_media: Count, hybrid_media: Count, premium_media: Count,
  estimated_savings_from_cache: Savings, estimated_savings_from_reuse: Savings, estimated_savings_from_deduplication: Savings,
  savings_from_model_routing: Savings, savings_from_deterministic_execution: Savings,
  cache_hit_rate: z.number().min(0).max(1).nullable(), asset_reuse_rate: z.number().min(0).max(1).nullable(),
  deterministic_task_rate: z.number().min(0).max(1).nullable(), cheap_model_rate: z.number().min(0).max(1).nullable(),
  standard_model_rate: z.number().min(0).max(1).nullable(), premium_model_rate: z.number().min(0).max(1).nullable(),
  template_media_rate: z.number().min(0).max(1).nullable(), hybrid_media_rate: z.number().min(0).max(1).nullable(),
  premium_media_rate: z.number().min(0).max(1).nullable(), average_tokens_per_task: Money.nullable(),
  average_cost_per_task: Money.nullable(), average_cost_per_creative: Money.nullable(),
  budget_warning_count: Count, budget_block_count: Count,
}).strict();
export const ExecutionSummarySchema = z.object({
  correlation_id: UUID, batch_id: UUID, brand_id: Slug, product_id: Slug,
  requested_variants: Count, variants_created: Count, manifests_created: Count, duplicates_prevented: Count,
  status: Status, qa: z.enum(['PASS', 'REVIEW', 'FAIL']), compliance: z.enum(['ALLOW', 'REVIEW', 'BLOCK']),
  data_label: DataLabel, data_notice: Text, deterministic_tasks: Count, ai_tasks_simulated_or_required: Count,
  assets_reused: Count, cache_hits: Count, cache_misses: Count, input_tokens_if_available: Count,
  output_tokens_if_available: Count, estimated_cost: Money, actual_cost_if_available: UnknownNumber,
  premium_task_rate: z.number().nullable(), budget_status: z.enum(['OK', 'WARN', 'BUDGET_BLOCKED']), outputs: Text,
}).strict();
export const BatchSchema = z.object({
  batch_id: UUID, correlation_id: UUID, request: BatchProductionRequestSchema, request_hash: Hash,
  input_fingerprint: Hash, status: Status, created_at: Timestamp, brand_version: Text, product_version: Text,
  schema_version: z.literal('0.1'),
}).strict();
export const StrategySchema = z.object({
  version: Text, mode: z.literal('DETERMINISTIC'), hypotheses: z.array(CreativeHypothesisSchema), dna: CreativeDNASchema,
}).strict();
export const BatchArtifactsSchema = z.object({
  batch: BatchSchema, brand: BrandContextSchema, product: ProductKnowledgeSchema, strategy: StrategySchema,
  matrix: GenerationMatrixSchema, variants: z.array(CreativeVariantSchema), manifests: z.array(ProductionManifestSchema),
  compliance: ComplianceDecisionSchema, qa: QAReportSchema, cost: CostReportSchema, efficiency: EfficiencyReportSchema,
  summary: ExecutionSummarySchema, assets: z.array(AssetRecordSchema), usage: z.array(AIUsageRecordSchema),
}).strict();

export type BrandContext = z.infer<typeof BrandContextSchema>;
export type ProductKnowledge = z.infer<typeof ProductKnowledgeSchema>;
export type SourceReference = z.infer<typeof SourceReferenceSchema>;
export type SourcedFact = z.infer<typeof SourcedFactSchema>;
export type CreativeHypothesis = z.infer<typeof CreativeHypothesisSchema>;
export type CreativeDNA = z.infer<typeof CreativeDNASchema>;
export type GenerationMatrix = z.infer<typeof GenerationMatrixSchema>;
export type CreativeVariant = z.infer<typeof CreativeVariantSchema>;
export type BatchProductionRequest = z.infer<typeof BatchProductionRequestSchema>;
export type ProductionManifest = z.infer<typeof ProductionManifestSchema>;
export type AssetRecord = z.infer<typeof AssetRecordSchema>;
export type AssetRegistry = z.infer<typeof AssetRegistrySchema>;
export type AITask = z.infer<typeof AITaskSchema>;
export type PromptTemplate = z.infer<typeof PromptTemplateSchema>;
export type AIUsageRecord = z.infer<typeof AIUsageRecordSchema>;
export type ProviderPricing = z.infer<typeof ProviderPricingSchema>;
export type BudgetPolicy = z.infer<typeof BudgetPolicySchema>;
export type ComplianceDecision = z.infer<typeof ComplianceDecisionSchema>;
export type QAReport = z.infer<typeof QAReportSchema>;
export type CostReport = z.infer<typeof CostReportSchema>;
export type EfficiencyReport = z.infer<typeof EfficiencyReportSchema>;
export type ExecutionSummary = z.infer<typeof ExecutionSummarySchema>;
export type BatchArtifacts = z.infer<typeof BatchArtifactsSchema>;
export type CostBreakdown = z.infer<typeof CostBreakdownSchema>;
