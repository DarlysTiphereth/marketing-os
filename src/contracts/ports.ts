import type { AITask, AIUsageRecord, AssetRecord, BatchArtifacts, BrandContext, CreativeVariant,
  ProductKnowledge, ProductionManifest, PromptTemplate, ProviderPricing, SourceReference } from './schemas.ts';

export interface BrandRepository { get(brandId: string): Promise<BrandContext> }
export interface ProductRepository { get(brandId: string, productId: string): Promise<ProductKnowledge> }
export interface BatchRepository {
  findByIdempotencyKey(brandId: string, key: string): Promise<BatchArtifacts | null>;
  withIdempotencyLock<T>(brandId: string, key: string, work: () => Promise<T>): Promise<T>;
  save(artifacts: BatchArtifacts): Promise<void>;
}
export interface CreativeRepository { get(batchId: string, creativeId: string): Promise<CreativeVariant> }
export interface AssetRepository { list(brandId: string, productId: string): Promise<AssetRecord[]> }
export interface UsageRepository { list(batchId: string): Promise<AIUsageRecord[]> }
export interface PricingRepository { get(provider: string, model: string, version: string): Promise<ProviderPricing> }
export interface SourceRepository { read(source: SourceReference): Promise<string> }
export interface Repositories {
  brands: BrandRepository; products: ProductRepository; batches: BatchRepository;
  creatives: CreativeRepository; assets: AssetRepository; usage: UsageRepository;
  pricing: PricingRepository; sources: SourceRepository;
}
export interface CacheRepository {
  get(key: string): Promise<{ value: unknown; created_at: string } | null>;
  put(key: string, value: unknown, createdAt: string): Promise<void>;
}
export interface LogEvent {
  event: string; correlation_id: string; batch_id: string | null; brand_id: string; product_id: string;
  creative_id?: string; decision?: string;
}
export interface Logger { log(event: LogEvent): void }
export interface ModelRouteInput {
  task_type: AITask['task_type']; complexity: AITask['complexity']; quality_requirement: AITask['quality_requirement'];
  latency_requirement: AITask['latency_requirement']; context_size: number; max_cost: number; currency: ProviderPricing['currency'];
  failed_tiers: Array<'CHEAP' | 'STANDARD'>; premium_justification: string | null; premium_allowed: boolean;
}
export interface ModelRoute { provider: string; model: string; tier: 'CHEAP' | 'STANDARD' | 'PREMIUM'; reason: string }
export interface ModelRouter { route(input: ModelRouteInput): ModelRoute }
export interface LLMProvider {
  execute(task: AITask, context: unknown, prompt: PromptTemplate): Promise<{ result: unknown; usage: AIUsageRecord }>;
  executeBatch(tasks: AITask[], contexts: unknown[], prompt: PromptTemplate): Promise<Array<{ task_id: string; result: unknown; usage: AIUsageRecord }>>;
}
export interface MediaTask { task_id: string; creative_id: string; brand_id: string; product_id: string;
  manifest: ProductionManifest; max_cost: number; idempotency_key: string }
export interface ImageProvider { generate(task: MediaTask): Promise<AssetRecord> }
export interface VideoProvider { generate(task: MediaTask): Promise<AssetRecord> }
export interface TTSProvider { generate(task: MediaTask): Promise<AssetRecord> }
export interface RenderingProvider { render(task: MediaTask, assets: AssetRecord[]): Promise<AssetRecord> }
export interface PublicationRequest {
  creative_id: string; creative_version: string; asset_id: string; platform: string; account: string;
  scheduled_at: string; idempotency_key: string;
}
export interface PublishingProvider { publish(request: PublicationRequest): Promise<{ publication_id: string }> }
export interface AnalyticsProvider { collect(publicationId: string): Promise<BusinessMetrics> }
export interface BusinessMetrics {
  brand_id: string; product_id: string; creative_id: string; variant_id: string; experiment_id: string;
  publication_id: string; views: number | null; retention: number | null; ctr: number | null;
  engagement: number | null; leads: number | null; conversions: number | null; revenue: number | null;
  cost_per_generated_creative: number | null; cost_per_approved_creative: number | null;
  cost_per_published_creative: number | null; cost_per_winning_creative: number | null;
  cost_per_lead: number | null; cost_per_conversion: number | null; revenue_per_creative: number | null;
  roas: number | null; roi: number | null;
}
export interface VersionedApproval { creative_id: string; creative_version_hash: string;
  status: 'WAITING_APPROVAL' | 'APPROVED' | 'REJECTED'; approved_by: string | null; approved_at: string | null }
export interface Job { job_id: string; batch_id: string; task_id: string; attempt: number;
  timeout_ms: number; idempotency_key: string }
