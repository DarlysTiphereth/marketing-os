import { randomUUID } from 'node:crypto';
import { BatchArtifactsSchema, BatchProductionRequestSchema, CostReportSchema, ExecutionSummarySchema, StrategySchema } from '../contracts/schemas.ts';
import type { BatchArtifacts, BatchProductionRequest, BudgetPolicy } from '../contracts/schemas.ts';
import type { Logger, Repositories } from '../contracts/ports.ts';
import { ContextBuilder } from '../ai/context.ts';
import { AssetRegistry } from '../domain/assets.ts';
import { hash, uuid } from '../domain/identity.ts';
import { validateProvenance } from '../domain/product.ts';
import { transition } from '../domain/status.ts';
import { compliancePrecheck } from '../compliance/policy.ts';
import { createManifest, createMatrix, createStrategy, DEFAULT_DNA, expandMatrix, VERSIONS } from '../creative-factory/factory.ts';
import { CostRouter, evaluateBudget } from '../cost/controls.ts';
import { efficiencyReport, ExecutionMetrics } from '../observability/metrics.ts';
import { executeQA } from './qa.ts';

export class GenerateBatch {
  private readonly repositories: Repositories;
  private readonly logger: Logger;
  private readonly now: () => string;
  private readonly outputRoot: string;
  constructor(repositories: Repositories, logger: Logger, outputRoot: string, now = () => new Date().toISOString()) {
    this.repositories = repositories; this.logger = logger; this.outputRoot = outputRoot; this.now = now;
  }
  async execute(raw: BatchProductionRequest): Promise<{ artifacts: BatchArtifacts; reused: boolean }> {
    const request = BatchProductionRequestSchema.parse(raw);
    const requestHash = hash(request);
    return this.repositories.batches.withIdempotencyLock(request.brand_id, request.idempotency_key, async () => {
      const existing = await this.repositories.batches.findByIdempotencyKey(request.brand_id, request.idempotency_key);
      if (existing) {
        if (existing.batch.request_hash !== requestHash) throw new Error('IDEMPOTENCY_CONFLICT: same key with different request');
        const brand = await this.repositories.brands.get(request.brand_id).catch((cause: unknown) => {
          throw new Error('STALE_INPUTS: brand no longer available', { cause });
        });
        const product = await this.repositories.products.get(request.brand_id, request.product_id).catch((cause: unknown) => {
          throw new Error('STALE_INPUTS: product no longer available', { cause });
        });
        const context = new ContextBuilder().build('MINIMAL', brand, product);
        const compliance = compliancePrecheck(brand, product, request, this.now());
        // The check time changes on replay; the deterministic decision/policy must remain identical.
        const comparableCompliance = { ...compliance, checked_at: existing.compliance.checked_at };
        if (hash({ brand, product, context, versions: VERSIONS }) !== existing.batch.input_fingerprint ||
          hash(comparableCompliance) !== hash(existing.compliance)) {
          throw new Error('STALE_INPUTS: current inputs or compliance differ from saved batch');
        }
        // Source bytes can change without updating the declared source hash in ProductKnowledge.
        try { await validateProvenance(product, this.repositories.sources); }
        catch (cause) { throw new Error('STALE_INPUTS: source verification failed', { cause }); }
        if (existing.compliance.decision === 'ALLOW') {
          const assets = await this.repositories.assets.list(request.brand_id, request.product_id).catch((cause: unknown) => {
            throw new Error('STALE_INPUTS: asset verification failed', { cause });
          });
          // AssetRegistry.reuse derives usage_count while expanding this batch; compare every other field.
          const currentAssets = assets.map(({ usage_count, ...asset }) => asset);
          const savedAssets = existing.assets.map(({ usage_count, ...asset }) => asset);
          if (hash(currentAssets) !== hash(savedAssets)) throw new Error('STALE_INPUTS: asset snapshot changed');
        }
        this.logger.log({ event: 'BATCH_REUSED', correlation_id: existing.batch.correlation_id, batch_id: existing.batch.batch_id,
          brand_id: request.brand_id, product_id: request.product_id });
        return { artifacts: existing, reused: true };
      }
      if (request.production_tier_preference !== 'TEMPLATE') throw new Error('V0_1_TEMPLATE_ONLY: other tiers require future priced media adapters');
      const now = this.now();
      const batchId = uuid(['batch', request.brand_id, request.idempotency_key]);
      const correlationId = randomUUID();
      const log = { correlation_id: correlationId, batch_id: batchId, brand_id: request.brand_id, product_id: request.product_id };
      this.logger.log({ event: 'BATCH_STARTED', ...log });
      const metrics = new ExecutionMetrics();
      const brand = await this.repositories.brands.get(request.brand_id); metrics.deterministic('load-brand');
      const product = await this.repositories.products.get(request.brand_id, request.product_id); metrics.deterministic('load-product');
      if (brand.brand_id !== product.brand_id || brand.data_label !== product.data_label) throw new Error('Brand/product identity/data-label mismatch');
      await validateProvenance(product, this.repositories.sources); metrics.deterministic('validate-provenance');
      const compliance = compliancePrecheck(brand, product, request, now); metrics.deterministic('compliance-precheck');
      this.logger.log({ event: 'COMPLIANCE_CHECKED', ...log, decision: compliance.decision });
      const allowed = compliance.decision === 'ALLOW';
      const context = new ContextBuilder().build('MINIMAL', brand, product); metrics.deterministic('minimal-context');
      const strategy = allowed ? createStrategy(request, product, batchId, now)
        : StrategySchema.parse({ version: VERSIONS.strategy, mode: 'DETERMINISTIC', hypotheses: [], dna: DEFAULT_DNA });
      if (allowed) metrics.deterministic('create-strategy');
      const matrix = allowed ? createMatrix(request, strategy, batchId)
        : { batch_id: batchId, template_version: VERSIONS.template, state: 'WITHHELD' as const, angles: [], hooks: [], visuals: [] };
      if (allowed) metrics.deterministic('create-matrix');
      const expansion = allowed ? expandMatrix(matrix, brand, product, request, now) : { variants: [], duplicates_prevented: 0 };
      if (allowed) metrics.deterministic('expand-and-deduplicate');
      const registry = new AssetRegistry(allowed ? await this.repositories.assets.list(brand.brand_id, product.product_id) : []);
      if (allowed) metrics.deterministic('load-asset-registry');
      const reusable = registry.lookup(brand.brand_id, product.product_id, 'TEMPLATE').filter(a => product.assets.includes(a.asset_id));
      if (allowed) metrics.deterministic('lookup-reusable-assets');
      if (allowed && !reusable.length) throw new Error('MISSING_TEMPLATE_ASSET: generation halted before manifest production');
      const policy: BudgetPolicy = { scope: 'PRODUCT', scope_id: `${brand.brand_id}/${product.product_id}`,
        period: 'BATCH', soft_limit: request.budget_limit * 0.8, hard_limit: request.budget_limit,
        currency: request.currency, warning_threshold: 0.8, premium_allowed: false };
      const budget = evaluateBudget(policy, 0, 0, request.currency); metrics.deterministic('evaluate-budget');
      const router = new CostRouter();
      const manifests = [];
      const variants = [];
      let reuseCount = 0;
      for (const creative of expansion.variants) {
        router.route({ reusable: false, deterministic: true, cache_hit: false, cheap_sufficient: true,
          standard_sufficient: true, premium_justification: null, policy, actual_spend: 0, estimated_cost: 0, currency: request.currency });
        metrics.deterministic(`${creative.creative_id}/cost-route`);
        const asset = reusable[0]!;
        registry.reuse(asset.asset_id, brand.brand_id, product.product_id); reuseCount++;
        metrics.deterministic(`${creative.creative_id}/reuse-asset`);
        const planned = transition(creative, 'PLANNED', now);
        const manifest = createManifest(planned, matrix, product, [asset.asset_id]);
        metrics.deterministic(`${creative.creative_id}/create-manifest`);
        manifests.push(manifest); variants.push(transition(planned, 'QA_REVIEW', now));
      }
      const cost = CostReportSchema.parse({ batch_id: batchId, currency: request.currency,
        estimated_llm_cost: 0, estimated_image_cost: 0, estimated_video_cost: 0, estimated_tts_cost: 0, estimated_render_cost: 0,
        estimated_total: 0, actual_total_if_available: 'NOT_AVAILABLE_YET', budget_limit: request.budget_limit,
        budget_remaining: budget.budget_remaining, pricing_version: 'no-paid-operations-1', budget_status: budget.status,
        estimate_scope: 'V0_1_PLANNING_ONLY', future_media_cost: 'NOT_AVAILABLE_YET' });
      metrics.deterministic('cost-report');
      const assets = registry.snapshot();
      const qa = executeQA({ batchId, brand, product, variants, manifests, assets, matrix, compliance, cost, now });
      metrics.deterministic('qa-batch');
      const finalVariants = variants.map(variant => {
        const report = qa.reports.find(r => r.creative_id === variant.creative_id)!;
        this.logger.log({ event: 'CREATIVE_CHECKED', ...log, creative_id: variant.creative_id, decision: report.status });
        metrics.deterministic(`${variant.creative_id}/qa-creative`);
        return transition(variant, report.status === 'PASS' ? 'READY_FOR_PRODUCTION' : 'BLOCKED', now);
      });
      const status = qa.status === 'PASS' && allowed ? 'READY_FOR_PRODUCTION' : 'BLOCKED';
      metrics.deterministic('efficiency-report');
      const efficiency = efficiencyReport({ batchId, deterministicTasks: metrics.count, variants: finalVariants,
        usage: [], cacheHits: 0, cacheMisses: 0, assetsReused: reuseCount, assetsNew: 0,
        duplicatesPrevented: expansion.duplicates_prevented, cost });
      const summary = ExecutionSummarySchema.parse({ ...log, requested_variants: request.angles * request.hooks_per_angle * request.visual_variants,
        variants_created: finalVariants.length, manifests_created: manifests.length, duplicates_prevented: expansion.duplicates_prevented,
        status, qa: qa.status, compliance: compliance.decision, data_label: product.data_label, data_notice: product.data_notice,
        deterministic_tasks: metrics.count, ai_tasks_simulated_or_required: 0, assets_reused: reuseCount,
        cache_hits: 0, cache_misses: 0, input_tokens_if_available: 0, output_tokens_if_available: 0,
        estimated_cost: cost.estimated_total, actual_cost_if_available: cost.actual_total_if_available,
        premium_task_rate: efficiency.premium_model_rate, budget_status: cost.budget_status,
        outputs: `${this.outputRoot}/${batchId}` });
      const artifacts = BatchArtifactsSchema.parse({ batch: { batch_id: batchId, correlation_id: correlationId, request,
        request_hash: requestHash, input_fingerprint: hash({ brand, product, context, versions: VERSIONS }), status,
        created_at: now, brand_version: brand.brand_version, product_version: product.product_version, schema_version: '0.1' },
        brand, product, strategy, matrix, variants: finalVariants, manifests, compliance, qa, cost, efficiency, summary, assets, usage: [] });
      await this.repositories.batches.save(artifacts);
      this.logger.log({ event: 'BATCH_SAVED', ...log });
      return { artifacts, reused: false };
    });
  }
}
