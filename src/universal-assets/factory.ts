import {AssetRecord, Scene} from './contracts.ts';
import {fingerprint, routeScene} from './router.ts';
import type {Candidate} from './router.ts';

// One opt-in binding for static, carousel, thumbnail, banner, video, faceless and commerce consumers.
// Existing factory and Seller/Affiliate contracts remain intact. No publication permission is granted here.
export function factoryAssets(consumer: 'STATIC'|'VIDEO'|'FACELESS'|'SELLER'|'AFFILIATE', scenes: unknown[], candidates: Candidate[], now = new Date()) {
  if(!scenes.length || scenes.length > 24) throw new Error('REVIEW_BATCH_LIMIT');
  const parsed = scenes.map(x=>Scene.parse(x)), scope=parsed[0]!;
  if(parsed.some(s=>s.brand_id!==scope.brand_id || s.product_id!==scope.product_id || s.product_version!==scope.product_version) ||
    new Set(parsed.map(s=>s.id)).size!==parsed.length) throw new Error('CAMPAIGN_SCOPE_OR_ID_MISMATCH');
  const plans = parsed.map(s=>routeScene(s,candidates,now));
  return {consumer, status:plans.every(p=>p.selected) ? 'STUDY_READY' as const : 'BLOCKED' as const,
    scenes:plans, binding:fingerprint({consumer,scenes:parsed,candidates}), publication:false, scale:'SUSPENDED' as const};
}
export function assertFactoryBinding(plan: ReturnType<typeof factoryAssets>, scenes: unknown[], candidates: Candidate[], now=new Date()) {
  candidates.forEach(c=>AssetRecord.parse(c.asset));
  const current=factoryAssets(plan.consumer,scenes,candidates,now);
  if(current.status!=='STUDY_READY' || current.binding!==plan.binding) throw new Error('STALE_OR_BLOCKED_ASSET_PLAN');
  return current.scenes.map(p=>p.selected!.asset);
}
