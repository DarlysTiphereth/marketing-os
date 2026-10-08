import {z} from 'zod';

export const Id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,95}$/);
const Text = z.string().min(1).max(500);
export const Money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const Currency = z.string().regex(/^[A-Z]{3}$/);
const Evidence = z.enum(['REAL_DATA', 'MOCK']);
const Permission = z.enum(['AUTHORIZED', 'UNKNOWN', 'REVOKED']);
const Eligibility = z.enum(['ELIGIBLE', 'UNKNOWN', 'BLOCKED']);
const Scope = {
  brand_id: Id, product_id: Id, shop_id: Id, market_id: Id,
  platform_id: z.enum(['tiktok-shop', 'instagram', 'facebook', 'youtube-shorts', 'shopee', 'mercado-livre', 'amazon']),
  language: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/), currency: Currency, evidence: Evidence,
};
const Context = {...Scope, account_id: Id, commerce_type: z.enum(['SELLER', 'AFFILIATE'])};
export const Claim = z.object({claim_id: Id, text: Text, source_ref: Text, approved: z.boolean(), language: Scope.language}).strict();
export const Brand = z.object({brand_id: Id, name: Text, evidence: Evidence}).strict();
export const Product = z.object({product_id: Id, brand_id: Id, name: Text, category: Id,
  version: Id, evidence: Evidence, claims: z.array(Claim).min(1),
  assets: z.array(z.object({asset_id: Id, sha256: z.string().regex(/^[a-f0-9]{64}$/),
    license_status: z.enum(['OWNED', 'LICENSED', 'UNKNOWN']), source_ref: Text}).strict()).min(1),
}).strict();
const Account = {account_id: Id, market_id: Id, platform_id: Scope.platform_id,
  evidence: Evidence, eligibility_status: Eligibility, promotion_permission: Permission};
export const SellerAccount = z.object({...Account, commerce_type: z.literal('SELLER'), seller_id: Id, brand_id: Id}).strict();
export const AffiliateAccount = z.object({...Account, commerce_type: z.literal('AFFILIATE'), affiliate_id: Id}).strict();
export const CommerceAccount = z.discriminatedUnion('commerce_type', [SellerAccount, AffiliateAccount]);
export const Shop = z.object({shop_id: Id, seller_id: Id, market_id: Id, platform_id: Scope.platform_id, evidence: Evidence}).strict();
export const CommerceListing = z.object({...Scope, listing_id: Id, seller_id: Id,
  product_price: Money.nullable(), stock_status: z.enum(['AVAILABLE', 'UNKNOWN', 'UNAVAILABLE']),
  eligibility_status: Eligibility, promotion_permission: Permission,
}).strict();
export const CommissionPlan = z.object({plan_id: Id, commission_rate: z.number().int().min(0).max(10000),
  currency: Currency, source_ref: Text, evidence: Evidence}).strict(); // rate in basis points, money in minor units
export const AffiliateOffer = z.object({...Scope, offer_id: Id, listing_id: Id, affiliate_id: Id,
  commission: CommissionPlan, promotion_permission: Permission, eligibility_status: Eligibility,
  expires_at: z.string().datetime(),
  quality: z.number().min(0).max(1).nullable(), reputation: z.number().min(0).max(1).nullable(),
  editorial_fit: z.number().min(0).max(1).nullable(), demonstrability: z.number().min(0).max(1).nullable(),
  return_risk: z.number().min(0).max(1).nullable(),
}).strict();
export const CreativeCampaign = z.object({...Context, campaign_id: Id, listing_id: Id,
  seller_id: Id.nullable(), affiliate_id: Id.nullable(), offer_id: Id.nullable(),
  estimated_margin: z.number().int().safe().nullable(), objective: Text,
}).strict().superRefine((c, ctx) => {
  if (c.commerce_type === 'SELLER' ? (!c.seller_id || c.affiliate_id !== null || c.offer_id !== null)
    : (!c.affiliate_id || c.seller_id !== null || !c.offer_id)) ctx.addIssue({code: 'custom', message: 'ACCOUNT_ISOLATION'});
});
export const CreativeVariant = z.object({campaign_id: Id, creative_id: Id,
  format: z.enum(['discovery', 'features', 'catalog']), script: Text,
  caption: Text, on_screen_text: z.array(Text).min(1).max(3), claim_refs: z.array(Id).min(1),
  duration_s: z.literal(18), faceless: z.literal(true), commercial_disclosure: Text,
}).strict();
export const ShoppableVideo = z.object({creative_id: Id, campaign_id: Id, listing_id: Id,
  sha256: z.string().regex(/^[a-f0-9]{64}$/), width: z.literal(1080), height: z.literal(1920),
  duration_s: z.number().min(17.9).max(18.1), qc_status: z.enum(['PASS', 'FAIL']),
  attachment_status: z.enum(['NOT_SUPPORTED', 'SIMULATED']), evidence: Evidence,
}).strict();
export const Publication = z.object({...Context, publication_id: Id, campaign_id: Id, creative_id: Id,
  status: z.enum(['BLOCKED', 'PREPARED', 'SIMULATED']), human_approved: z.boolean(),
  reasons: z.array(Text), input_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
const Order = {...Context, order_id: Id, campaign_id: Id, creative_id: Id, listing_id: Id,
  status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']), gmv: Money, source_ref: Text};
export const OrderAttribution = z.discriminatedUnion('commerce_type', [
  z.object({...Order, commerce_type: z.literal('SELLER'), net_revenue: Money.nullable(), cost: Money.nullable(),
    refund: Money, commission: z.literal(null)}).strict(),
  z.object({...Order, commerce_type: z.literal('AFFILIATE'), net_revenue: z.literal(null), cost: z.literal(null),
    refund: z.literal(null), commission: Money}).strict(),
]);
export const PerformanceEvent = z.object({...Context, event_id: Id, campaign_id: Id, creative_id: Id,
  observed_at: z.string().datetime(), source_ref: Text,
  views: Money.nullable(), clicks: Money.nullable(), conversions: Money.nullable(),
  retention: z.number().min(0).max(1).nullable(),
}).strict().superRefine((e, ctx) => {
  if (e.views !== null && e.clicks !== null && e.clicks > e.views)
    ctx.addIssue({code: 'custom', message: 'CLICKS_EXCEED_VIEWS'});
});

export type ProductT = z.infer<typeof Product>;
export type AccountT = z.infer<typeof CommerceAccount>;
export type ListingT = z.infer<typeof CommerceListing>;
export type OfferT = z.infer<typeof AffiliateOffer>;
export type CampaignT = z.infer<typeof CreativeCampaign>;
export type VariantT = z.infer<typeof CreativeVariant>;
export type OrderT = z.infer<typeof OrderAttribution>;
export type EventT = z.infer<typeof PerformanceEvent>;
