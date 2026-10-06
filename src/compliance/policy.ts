import { ComplianceDecisionSchema } from '../contracts/schemas.ts';
import type { BatchProductionRequest, BrandContext, ComplianceDecision, ProductKnowledge } from '../contracts/schemas.ts';

export function compliancePrecheck(brand: BrandContext, product: ProductKnowledge, request: BatchProductionRequest, now: string): ComplianceDecision {
  let decision: ComplianceDecision['decision'] = 'ALLOW';
  let reason = 'Planejamento factual sujeito a QA; não é autorização para publicação.';
  const category = product.category.toUpperCase();
  if (['TOBACCO', 'VAPE', 'E_CIGARETTE', 'TABACO', 'NICOTINE'].includes(category)) {
    decision = 'BLOCK'; reason = 'Política interna conservadora bloqueia conteúdo promocional dessas categorias.';
  } else if (brand.brand_id === 'safezone' || brand.compliance_profile === 'REGULATED_CONSERVATIVE' || category === 'UNKNOWN') {
    decision = 'REVIEW'; reason = 'Informação regulatória/categoria insuficiente; revisão humana necessária antes da geração.';
  }
  return ComplianceDecisionSchema.parse({ brand_id: brand.brand_id, product_id: product.product_id,
    market: brand.default_market, platform: request.platform, content_type: request.format,
    stage: 'PRE_GENERATION', decision, reason, policy_version: 'internal-conservative-1', checked_at: now });
}
