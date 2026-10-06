import type { BrandContext, ProductKnowledge } from '../contracts/schemas.ts';

export type ContextProfile = 'MINIMAL' | 'PRODUCT' | 'CREATIVE' | 'COMPLIANCE' | 'ANALYTICS';
export class ContextBuilder {
  build(profile: ContextProfile, brand: BrandContext, product: ProductKnowledge) {
    if (brand.brand_id !== product.brand_id) throw new Error('Context brand/product mismatch');
    const minimal = { brand_id: brand.brand_id, product_id: product.product_id, brand_version: brand.brand_version,
      product_version: product.product_version, name: product.name,
      official_description: product.official_description, data_label: product.data_label };
    switch (profile) {
      case 'MINIMAL': return minimal;
      case 'PRODUCT': return { ...minimal, confirmed_features: product.confirmed_features,
        confirmed_benefits: product.confirmed_benefits, usage_instructions: product.usage_instructions, warnings: product.warnings };
      case 'CREATIVE': return { ...minimal, confirmed_features: product.confirmed_features,
        tone_of_voice: brand.tone_of_voice, visual_rules: brand.visual_rules, content_rules: brand.content_rules,
        prohibited_claims: product.prohibited_claims, prohibited_patterns: brand.prohibited_patterns };
      case 'COMPLIANCE': return { brand_id: brand.brand_id, product_id: product.product_id, category: product.category,
        market: brand.default_market, compliance_profile: brand.compliance_profile,
        prohibited_claims: product.prohibited_claims, warnings: product.warnings };
      case 'ANALYTICS': return { brand_id: brand.brand_id, product_id: product.product_id,
        brand_version: brand.brand_version, product_version: product.product_version };
    }
  }
}
