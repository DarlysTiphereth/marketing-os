import {Product, type ProductT} from './contracts.ts';
import {validateInputs, type Inputs} from './engine.ts';

export const REVIEW_REQUIRED = {human_approved_fingerprint: null, qc_pass: false, category_status: 'UNKNOWN' as const,
  commercial_policy_verified: false, ai_disclosure_required: null, ai_disclosure_present: false,
  publication_limit_remaining: null, api_authorized: false};
export function sellerPilot(product: ProductT): Inputs {
  const scope = {brand_id: product.brand_id, product_id: product.product_id, shop_id: 'grand-unverified-shop',
    market_id: 'br', platform_id: 'tiktok-shop' as const, language: 'pt-BR', currency: 'BRL', evidence: 'REAL_DATA' as const};
  return validateInputs({product,
    account: {account_id: 'grand-unverified-seller', commerce_type: 'SELLER', seller_id: 'grand-unverified-seller',
      brand_id: product.brand_id, market_id: 'br', platform_id: 'tiktok-shop', evidence: 'REAL_DATA',
      eligibility_status: 'UNKNOWN', promotion_permission: 'UNKNOWN'},
    listing: {...scope, listing_id: 'grand-unverified-listing', seller_id: 'grand-unverified-seller', product_price: null,
      stock_status: 'UNKNOWN', eligibility_status: 'UNKNOWN', promotion_permission: 'UNKNOWN'},
    campaign: {...scope, campaign_id: 'grand-commerce-pilot', account_id: 'grand-unverified-seller', commerce_type: 'SELLER',
      listing_id: 'grand-unverified-listing', seller_id: 'grand-unverified-seller', affiliate_id: null,
      offer_id: null, estimated_margin: null, objective: 'Preview interno de catálogo com copy aprovada; nenhuma autorização de Shop presumida.'},
    offer: null});
}
export function affiliatePilot(assetHash: string): Inputs {
  const scope = {brand_id: 'mock-home', product_id: 'mock-pano', shop_id: 'mock-shop', market_id: 'br',
    platform_id: 'tiktok-shop' as const, language: 'pt-BR', currency: 'BRL', evidence: 'MOCK' as const};
  const product = Product.parse({brand_id: 'mock-home', product_id: 'mock-pano', name: 'MOCK · Pano de limpeza fictício',
    category: 'household-cloth', version: 'mock-v1', evidence: 'MOCK',
    claims: [{claim_id: 'mock-name', text: 'Pano de limpeza fictício', source_ref: 'Synthetic benchmark definition; not real product data', approved: true, language: 'pt-BR'},
      {claim_id: 'mock-color', text: 'Design azul · MOCK', source_ref: 'Owned synthetic SVG artwork', approved: true, language: 'pt-BR'}],
    assets: [{asset_id: 'mock-packshot', sha256: assetHash, license_status: 'OWNED', source_ref: 'Original synthetic SVG generated for this test'}]});
  return validateInputs({product, account: {account_id: 'mock-affiliate', affiliate_id: 'mock-affiliate', commerce_type: 'AFFILIATE',
    market_id: 'br', platform_id: 'tiktok-shop', evidence: 'MOCK', eligibility_status: 'ELIGIBLE', promotion_permission: 'AUTHORIZED'},
    listing: {...scope, listing_id: 'mock-listing', seller_id: 'mock-seller', product_price: 3000,
      stock_status: 'AVAILABLE', eligibility_status: 'ELIGIBLE', promotion_permission: 'AUTHORIZED'},
    campaign: {...scope, campaign_id: 'mock-affiliate-pilot', account_id: 'mock-affiliate', commerce_type: 'AFFILIATE',
      listing_id: 'mock-listing', seller_id: null, affiliate_id: 'mock-affiliate', offer_id: 'mock-offer', estimated_margin: null,
      objective: 'MOCK: validar fluxo afiliado isolado sem publicação ou transação real.'},
    offer: {...scope, offer_id: 'mock-offer', listing_id: 'mock-listing', affiliate_id: 'mock-affiliate',
      commission: {plan_id: 'mock-commission', commission_rate: 1000, currency: 'BRL', evidence: 'MOCK', source_ref: 'Synthetic fixture: 10%; not a real commission offer'},
      promotion_permission: 'AUTHORIZED', eligibility_status: 'ELIGIBLE', expires_at: '2099-01-01T00:00:00Z',
      quality: null, reputation: null, editorial_fit: 0.8, demonstrability: 0.7, return_risk: null}});
}
