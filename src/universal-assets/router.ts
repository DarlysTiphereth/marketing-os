import {createHash} from 'node:crypto';
import {AssetRecord, Capability, Scene, Strategy, dimensions} from './contracts.ts';
import type {AssetT, SceneT, StrategyT} from './contracts.ts';

const sameScope = (a: NonNullable<AssetT['scope']>, s: SceneT) =>
  a.brand_id === s.brand_id && a.product_id === s.product_id && a.product_version === s.product_version;
export const fingerprint = (value: unknown): string => {
  const canonical = (v: unknown): string => Array.isArray(v) ? `[${v.map(canonical).join(',')}]` :
    v && typeof v === 'object' ? `{${Object.entries(v).sort(([a],[b]) => a.localeCompare(b)).map(([k,x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(',')}}` : JSON.stringify(v);
  return createHash('sha256').update(canonical(value)).digest('hex');
};
export function cinematicMatch(scene: SceneT, asset: AssetT, previous?: AssetT) {
  let known = 0, matches = 0;
  for (const k of dimensions) if (scene.cinema[k] !== null) {known++; if (scene.cinema[k] === asset.cinema[k]) matches++;}
  const fit = known ? matches / known : 0; // Unknown cinematography cannot earn a match.
  const continuity = previous ? ['color','lighting','camera_direction','continuity'].filter(k =>
    previous.cinema[k as typeof dimensions[number]] !== null && previous.cinema[k as typeof dimensions[number]] === asset.cinema[k as typeof dimensions[number]]).length / 4 : 1;
  return {fit, continuity};
}
export function rejectReasons(scene: SceneT, asset: AssetT, now: Date) {
  const r: string[] = [];
  if (!asset.rights_verified || !asset.allowed_use.includes(scene.use)) r.push('RIGHTS_NOT_AUTHORIZED');
  if (Date.parse(asset.retrieval_date) > now.getTime()) r.push('FUTURE_PROVENANCE');
  if (asset.retention_until && Date.parse(asset.retention_until) <= now.getTime()) r.push('RETENTION_EXPIRED');
  if (!asset.faceless_verified) r.push('FACELESS_NOT_VERIFIED');
  if (asset.kind !== scene.kind) r.push('MEDIA_KIND_MISMATCH');
  if (asset.cost_brl !== 0) r.push('ZERO_BUDGET_UNVERIFIED');
  if (asset.elapsed_s === null || asset.elapsed_s > scene.max_elapsed_s) r.push('TIME_BUDGET_UNVERIFIED');
  if (asset.quality_score < scene.min_quality || asset.realism_score < scene.min_realism) r.push('QUALITY_BELOW_THRESHOLD');
  if (!asset.tags.category.includes(scene.category) || !asset.tags.format.includes(scene.format) ||
    !(asset.tags.language.includes(scene.language) || asset.tags.language.includes('neutral'))) r.push('TAG_MISMATCH');
  if (asset.scope && !sameScope(asset.scope, scene)) r.push('PRODUCT_SCOPE_MISMATCH');
  if (asset.fidelity !== scene.fidelity) r.push('FIDELITY_MISMATCH'); // No implicit upgrade of stock, AI or packshot to proof.
  if (scene.claim_ids.some(id => !scene.approved_claim_ids.includes(id))) r.push('UNAPPROVED_CLAIM');
  if (scene.fidelity === 'GENERIC_VISUAL' && scene.claim_ids.length) r.push('GENERIC_VISUAL_CANNOT_PROVE_CLAIM');
  if (['REAL_DEMONSTRATION','VERIFIED_RESULT'].includes(scene.fidelity) &&
    scene.claim_ids.some(id => !asset.evidence?.claim_ids.includes(id))) r.push('CLAIM_EVIDENCE_MISSING');
  if (scene.fidelity === 'VERIFIED_RESULT' && !scene.claim_ids.length) r.push('RESULT_CLAIM_REQUIRED');
  if (cinematicMatch(scene, asset).fit < scene.min_match) r.push('CINEMATIC_MISMATCH');
  return r;
}
export type Candidate = {asset: unknown; strategy: StrategyT};
export function routeScene(input: unknown, candidates: Candidate[], now = new Date()) {
  const scene = Scene.parse(input), parsed = candidates.map(c => ({asset:AssetRecord.parse(c.asset), strategy:Strategy.parse(c.strategy)}));
  if (new Set(parsed.map(c => c.asset.id)).size !== parsed.length) throw new Error('DUPLICATE_ASSET_ID');
  const previous = parsed.find(c => c.asset.asset_hash === scene.previous_asset_hash)?.asset;
  const ranked = parsed.map(c => {
    const reasons = rejectReasons(scene,c.asset,now);
    if (!scene.allowed_strategies.includes(c.strategy)) reasons.push('STRATEGY_NOT_ALLOWED');
    if (c.strategy === 'APPROVED_REUSE' && (!c.asset.approval || c.asset.approval.asset_hash !== c.asset.asset_hash ||
      !sameScope(c.asset.approval.scope,scene))) reasons.push('APPROVAL_NOT_BOUND_TO_PRODUCT_AND_BYTES');
    if (['SYNTHETIC_IMAGE','IMAGE_TO_VIDEO'].includes(c.strategy) && !c.asset.synthetic) reasons.push('SYNTHETIC_PROVENANCE_REQUIRED');
    if (c.strategy === 'PRODUCT_COMPOSITE' && (c.asset.fidelity !== 'PRODUCT_VISUAL' || c.asset.derivation?.strategy !== c.strategy)) reasons.push('COMPOSITION_PROVENANCE_REQUIRED');
    if(c.asset.derivation?.strategy === 'PRODUCT_COMPOSITE' && !parsed.some(x=>c.asset.derivation?.input_hashes.includes(x.asset.asset_hash) &&
      x.asset.fidelity==='PRODUCT_VISUAL' && !x.asset.synthetic && x.asset.scope && sameScope(x.asset.scope,scene) &&
      x.asset.rights_verified && x.asset.allowed_use.includes(scene.use) &&
      (!x.asset.retention_until || Date.parse(x.asset.retention_until)>now.getTime()))) reasons.push('AUTHENTIC_PRODUCT_INPUT_REQUIRED');
    const match = cinematicMatch(scene,c.asset,previous);
    const repeated = scene.campaign_asset_hashes.includes(c.asset.asset_hash);
    const score = .25*c.asset.quality_score + .2*c.asset.realism_score + .2*match.fit + .15*match.continuity +
      .1*c.asset.product_relevance + .05*(1-Math.min(1,(c.asset.elapsed_s ?? scene.max_elapsed_s)/scene.max_elapsed_s)) +
      .05*(repeated ? 0 : 1);
    return {...c,reasons,score,match};
  }).sort((a,b) => b.score-a.score || a.asset.id.localeCompare(b.asset.id));
  const selected = ranked.find(c => !c.reasons.length) ?? null;
  return {status:selected ? 'STUDY_READY' as const : 'REJECTED' as const, scene, selected, ranked,
    input_fingerprint:fingerprint({scene,candidates:parsed}), human_approval:'PENDING' as const, scale:'SUSPENDED' as const};
}
export function executableCapability(input: unknown, scene: SceneT, now = new Date()) {
  const c = Capability.parse(input);
  return ['AVAILABLE_FREE','LIMITED_FREE'].includes(c.status) && c.cloud && c.commercial_license_verified &&
    c.additional_cost_brl === 0 && c.quota_verified && c.remaining_calls > 0 &&
    c.max_elapsed_s <= scene.max_elapsed_s && Date.parse(c.expires_at) > now.getTime() && scene.allowed_strategies.includes(c.strategy);
}

// Providers execute outside the domain. A request is never confused with a materialized asset.
export type Ports = {existing: (scene: SceneT) => Promise<Candidate[]>;
  acquire: (strategy: StrategyT, scene: SceneT) => Promise<Candidate[]>;
  verify: (asset: AssetT) => Promise<boolean>};
export async function resolveScene(input: unknown, capabilities: unknown[], ports: Ports, now = new Date()) {
  const scene = Scene.parse(input), attempts: {strategy:StrategyT; result:string}[] = [];
  const checked = async (c: Candidate[]) => {
    const verified: Candidate[] = [];
    for (const x of c) if (await ports.verify(AssetRecord.parse(x.asset))) verified.push(x);
    return verified;
  };
  let candidates = await checked(await ports.existing(scene));
  let result = routeScene(scene,candidates,now);
  if (result.selected) return {...result,attempts};
  // Each route at most once, and no paid/local GPU fallback.
  for (const raw of capabilities) {
    const c = Capability.parse(raw);
    if (attempts.some(a => a.strategy === c.strategy) || !executableCapability(c,scene,now)) continue;
    try {
      const acquired = await checked(await ports.acquire(c.strategy,scene));
      if (acquired.some(a => a.strategy !== c.strategy)) throw new Error('PROVIDER_STRATEGY_MISMATCH');
      candidates = [...candidates,...acquired]; result = routeScene(scene,candidates,now);
      attempts.push({strategy:c.strategy,result:result.status});
      if (result.selected) break;
    } catch {attempts.push({strategy:c.strategy,result:'ACQUISITION_FAILED'});} // Never log URLs/keys from provider errors.
  }
  return {...result,attempts};
}
