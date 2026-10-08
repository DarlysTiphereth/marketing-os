import {createHash} from 'node:crypto';
import {z} from 'zod';

const Text = z.string().trim().min(1).max(1500);
const Id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/);
const Hash = z.string().regex(/^[a-f0-9]{64}$/);
export const Asset = z.object({id: Id, kind: z.enum(['PACKSHOT', 'CATEGORY_FOOTAGE', 'PRODUCT_DEMO', 'AUDIO', 'FONT']),
  sha256: Hash, source: Text, rights: z.enum(['CC0', 'PEXELS', 'OFL', 'INTERNAL_USER_ASSET', 'UNKNOWN']),
  available: z.boolean(), verified_bytes: z.boolean(), width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(), product_id: Id.nullable()}).strict();
export const Concept = z.object({id: Id, title: Text, audience: Text.min(25), problem: Text.min(25),
  proven_benefit: z.object({text: Text, source: Text, proof_scope: z.enum(['APPROVED_LABEL_ONLY', 'OBSERVED_CATEGORY_ACTION'])}).strict(),
  central_idea: Text.min(25), differentiator: Text.min(25), hook: Text.min(12), sales_argument: Text.min(25),
  visual_language: Text.min(25), cta: Text, scope: z.enum(['PRODUCT_STUDY', 'CATEGORY_STUDY']),
  duration_s: z.number().min(5).max(8), required_assets: z.array(Id).min(1),
  narrative: z.array(z.object({at_s: z.number().min(0), duration_s: z.number().positive(), action: Text,
    copy: Text, asset_ids: z.array(Id).min(1)}).strict()).min(2).max(4),
  limitations: z.array(Text).min(1)}).strict().superRefine((c, ctx) => {
  if (/^(conheça (o produto|a marca)|veja os detalhes|qualidade que você merece)[.!]?$/i.test(c.hook))
    ctx.addIssue({code: 'custom', message: 'GENERIC_CONCEPT'});
  if (new Set(c.required_assets).size !== c.required_assets.length)
    ctx.addIssue({code: 'custom', message: 'DUPLICATE_ASSET_REQUIREMENT'});
  let end = 0;
  for (const s of c.narrative) {
    if (Math.abs(s.at_s - end) > .001 || s.asset_ids.some(id => !c.required_assets.includes(id)))
      ctx.addIssue({code: 'custom', message: 'INVALID_NARRATIVE_BINDING'});
    end = s.at_s + s.duration_s;
  }
  if (Math.abs(end - c.duration_s) > .001) ctx.addIssue({code: 'custom', message: 'INVALID_SAMPLE_DURATION'});
});
export type ConceptT = z.infer<typeof Concept>;
export type AssetT = z.infer<typeof Asset>;

// No filesystem, providers or automatic substitution inside creative direction.
export function assetFirst(concept: unknown, assets: unknown[]) {
  const c = Concept.parse(concept), parsed = assets.map(a => Asset.parse(a));
  if (new Set(parsed.map(a => a.id)).size !== parsed.length) throw new Error('DUPLICATE_ASSET_ID');
  const reasons: string[] = [];
  for (const id of c.required_assets) {
    const a = parsed.find(a => a.id === id);
    if (!a?.available || !a.verified_bytes) reasons.push(`MISSING_OR_UNVERIFIED_ASSET:${id}`);
    else if (a.rights === 'UNKNOWN') reasons.push(`UNKNOWN_ASSET_RIGHTS:${id}`);
  }
  if (c.scope === 'PRODUCT_STUDY' && c.proven_benefit.proof_scope !== 'APPROVED_LABEL_ONLY')
    reasons.push('CATEGORY_ACTION_CANNOT_PROVE_PRODUCT_BENEFIT');
  return {status: reasons.length ? 'BLOCKED' as const : 'STUDY_ONLY' as const, reasons, concept: c};
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v !== null && typeof v === 'object') return `{${Object.entries(v).sort(([a], [b]) => a.localeCompare(b))
    .map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(',')}}`;
  return JSON.stringify(v);
}
export function reviewFingerprint(concept: unknown, assets: unknown[], videoSha256: string) {
  const c = Concept.parse(concept), a = assets.map(x => Asset.parse(x)); Hash.parse(videoSha256);
  return createHash('sha256').update(canonical({concept: c, assets: a, video_sha256: videoSha256})).digest('hex');
}
const Review = z.object({status: z.enum(['PASS', 'PENDING', 'REJECTED', 'BLOCKED']), notes: z.array(Text),
  reviewer: Text.nullable(), reviewed_at: z.string().datetime().nullable(), fingerprint: Hash.nullable()}).strict();
export const QualityGates = z.object({TECHNICAL_QC: Review, CREATIVE_QC: Review, BRAND_QC: Review,
  COMMERCE_QC: Review, HUMAN_APPROVAL: Review}).strict();
export function pendingGates(technicalPass: boolean) {
  const review = (status: 'PASS' | 'PENDING' | 'BLOCKED', notes: string[]) =>
    ({status, notes, reviewer: null, reviewed_at: null, fingerprint: null});
  return QualityGates.parse({TECHNICAL_QC: review(technicalPass ? 'PASS' : 'BLOCKED', ['Measured media checks only']),
    CREATIVE_QC: review('PENDING', ['User rejected previous benchmark; explicit visual review required']),
    BRAND_QC: review('PENDING', ['Official brand book and publication rights not verified']),
    COMMERCE_QC: review('BLOCKED', ['No verified live offer, permission or product-use proof']),
    HUMAN_APPROVAL: review('PENDING', ['No human approval has been supplied'])});
}
export function scaleDecision(gates: unknown, fingerprint: string) {
  Hash.parse(fingerprint); const g = QualityGates.parse(gates);
  const reasons = Object.entries(g).filter(([name, r]) => r.status !== 'PASS' ||
    (name !== 'TECHNICAL_QC' && (!r.reviewer || !r.reviewed_at || r.fingerprint !== fingerprint))).map(([name]) => name);
  return {status: reasons.length ? 'SCALE_SUSPENDED' as const : 'ELIGIBLE_FOR_HUMAN_AUTHORIZED_SCALE' as const, reasons};
}
export function sampleBatch(concepts: unknown[]) {
  if (concepts.length !== 2) throw new Error('EXACTLY_TWO_QUALITY_SAMPLES_REQUIRED');
  const c = concepts.map(x => Concept.parse(x));
  if (new Set(c.map(x => x.id)).size !== 2 || c[0]!.visual_language === c[1]!.visual_language)
    throw new Error('DISTINCT_ART_DIRECTIONS_REQUIRED');
  return c;
}
