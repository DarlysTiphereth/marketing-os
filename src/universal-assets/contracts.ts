import {z} from 'zod';

export const Id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
export const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Text = z.string().trim().min(1).max(1500);
export const LocalRef = z.string().max(300).regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9_.@\/-]+$/);
export const Fidelity = z.enum(['GENERIC_VISUAL', 'PRODUCT_VISUAL', 'REAL_DEMONSTRATION', 'VERIFIED_RESULT']);
export const Strategy = z.enum(['EXISTING_LICENSED', 'STOCK_SEARCH', 'SYNTHETIC_IMAGE', 'IMAGE_TO_VIDEO', 'PRODUCT_COMPOSITE', 'APPROVED_REUSE']);
export const Availability = z.enum(['AVAILABLE_FREE', 'LIMITED_FREE', 'PAID_ONLY', 'NOT_SUPPORTED', 'NOT_TESTED']);
export const dimensions = ['motion', 'framing', 'lighting', 'camera_direction', 'color', 'perspective', 'texture',
  'continuity', 'narrative', 'composition', 'text_space', 'product_compatibility'] as const;
export const Cinema = z.object(Object.fromEntries(dimensions.map(k => [k, Text.nullable()])) as Record<typeof dimensions[number], z.ZodNullable<z.ZodString>>).strict();
export const Tags = z.object({category: z.array(Text), use: z.array(Text), scenario: z.array(Text), aesthetic: z.array(Text),
  audience: z.array(Text), language: z.array(Text), format: z.array(Text), compatibility: z.array(Text)}).strict();
const Scope = z.object({brand_id: Id, product_id: Id, product_version: Text}).strict();
export const AssetRecord = z.object({
  id: Id, source_url: z.string().url(), creator: Text, license: Text, license_version: Text,
  retrieval_date: z.string().datetime(), allowed_use: z.array(z.enum(['INTERNAL_STUDY', 'ADVERTISEMENT'])).min(1),
  asset_hash: Hash, local_ref: LocalRef, bytes: z.number().int().positive(), kind: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'FONT']),
  proof_ref: LocalRef, proof_hash: Hash, rights_verified: z.boolean(), redistribute_original: z.literal(false),
  retention_until: z.string().datetime().nullable(), product_relevance: z.number().min(0).max(1),
  quality_score: z.number().min(0).max(1), realism_score: z.number().min(0).max(1),
  fidelity: Fidelity, synthetic: z.boolean(), faceless_verified: z.boolean(), scope: Scope.nullable(),
  evidence: z.object({source_url: z.string().url(), proof_ref: LocalRef, proof_hash: Hash, verified: z.boolean(), claim_ids: z.array(Id)}).strict().nullable(),
  approval: z.object({reviewer: Text, asset_hash: Hash, scope: Scope}).strict().nullable(),
  cost_brl: z.number().nonnegative().nullable(), elapsed_s: z.number().nonnegative().nullable(),
  tags: Tags, cinema: Cinema, derivation: z.object({strategy: Strategy, input_hashes: z.array(Hash).min(1)}).strict().nullable(),
}).strict().superRefine((a, ctx) => {
  if (a.fidelity !== 'GENERIC_VISUAL' && !a.scope) ctx.addIssue({code:'custom', message:'PRODUCT_SCOPE_REQUIRED'});
  if (a.synthetic && ['REAL_DEMONSTRATION','VERIFIED_RESULT'].includes(a.fidelity))
    ctx.addIssue({code:'custom', message:'SYNTHETIC_IS_NOT_REAL_PROOF'});
  if (a.synthetic && a.fidelity === 'PRODUCT_VISUAL' && a.derivation?.strategy !== 'PRODUCT_COMPOSITE')
    ctx.addIssue({code:'custom', message:'AUTHENTIC_PRODUCT_COMPOSITION_REQUIRED'});
  if (['REAL_DEMONSTRATION','VERIFIED_RESULT'].includes(a.fidelity) && !a.evidence?.verified)
    ctx.addIssue({code:'custom', message:'VERIFIED_EVIDENCE_REQUIRED'});
});
export const Scene = z.object({id: Id, ...Scope.shape, category: Text, language: Text, format: Text,
  use: z.enum(['INTERNAL_STUDY','ADVERTISEMENT']), fidelity: Fidelity, kind: z.enum(['IMAGE','VIDEO']),
  claim_ids: z.array(Id), approved_claim_ids: z.array(Id), query: Text.max(100), cinema: Cinema,
  min_quality: z.number().min(0).max(1), min_realism: z.number().min(0).max(1), min_match: z.number().min(0).max(1),
  max_elapsed_s: z.number().positive(), previous_asset_hash: Hash.nullable(),
  allowed_strategies: z.array(Strategy).min(1), campaign_asset_hashes: z.array(Hash),
}).strict();
export const Capability = z.object({id: Id, strategy: Strategy, status: Availability, cloud: z.boolean(),
  commercial_license_verified: z.boolean(), additional_cost_brl: z.number().nonnegative().nullable(),
  quota_verified: z.boolean(), remaining_calls: z.number().int().nonnegative(), max_elapsed_s: z.number().positive(),
  expires_at: z.string().datetime(), evidence_url: z.string().url()}).strict();
export type AssetT = z.infer<typeof AssetRecord>;
export type SceneT = z.infer<typeof Scene>;
export type CapabilityT = z.infer<typeof Capability>;
export type StrategyT = z.infer<typeof Strategy>;
