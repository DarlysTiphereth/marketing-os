import {createHash} from 'node:crypto';
import {z} from 'zod';
import {Id, AffiliateOffer, CommerceAccount, CommerceListing, CreativeCampaign, CreativeVariant, Product,
  type AccountT, type CampaignT, type ListingT, type OfferT, type ProductT, type VariantT} from './contracts.ts';

export function fingerprint(value: unknown): string {
  const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canonical(x)])) : v;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export function commission(amount: number, rate: number): number {
  if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isInteger(rate) || rate < 0 || rate > 10000)
    throw new Error('INVALID_COMMISSION');
  return Number(BigInt(amount) * BigInt(rate) / 10000n); // floor; no floating point money
}
export function estimatedMargin(price: number | null, costs: (number | null)[]): number | null {
  if (price === null || costs.length === 0 || costs.some(c => c === null)) return null;
  if (![price, ...costs].every(c => Number.isSafeInteger(c) && c! >= 0)) throw new Error('INVALID_COST');
  const result = BigInt(price) - costs.reduce<bigint>((n, c) => n + BigInt(c!), 0n);
  if (result > BigInt(Number.MAX_SAFE_INTEGER) || result < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('MONEY_OVERFLOW');
  return Number(result);
}
export type Inputs = {campaign: CampaignT; account: AccountT; product: ProductT; listing: ListingT; offer: OfferT | null};
export function validateInputs(raw: Inputs): Inputs {
  const i = {campaign: CreativeCampaign.parse(raw.campaign), account: CommerceAccount.parse(raw.account),
    product: Product.parse(raw.product), listing: CommerceListing.parse(raw.listing),
    offer: raw.offer === null ? null : AffiliateOffer.parse(raw.offer)};
  const {campaign: c, account: a, product: p, listing: l, offer: o} = i;
  const same = (x: Record<string, unknown>, keys: string[]) => keys.every(k => x[k] === (c as Record<string, unknown>)[k]);
  if (!same(a, ['account_id', 'commerce_type', 'market_id', 'platform_id', 'evidence'])
    || !same(p, ['brand_id', 'product_id', 'evidence'])
    || !same(l, ['listing_id', 'brand_id', 'product_id', 'shop_id', 'market_id', 'platform_id', 'language', 'currency', 'evidence']))
    throw new Error('CONTEXT_ISOLATION');
  if (a.commerce_type === 'SELLER') {
    if (c.seller_id !== a.seller_id || a.brand_id !== p.brand_id || l.seller_id !== a.seller_id || o !== null)
      throw new Error('SELLER_ISOLATION');
  } else if (!o || c.affiliate_id !== a.affiliate_id || o.affiliate_id !== a.affiliate_id
    || !same(o, ['offer_id', 'listing_id', 'brand_id', 'product_id', 'shop_id', 'market_id', 'platform_id', 'language', 'currency', 'evidence'])
    || o.commission.currency !== c.currency || o.commission.evidence !== c.evidence) throw new Error('AFFILIATE_ISOLATION');
  if (c.commerce_type === 'AFFILIATE' && c.estimated_margin !== null) throw new Error('AFFILIATE_HAS_SELLER_MARGIN');
  return i;
}
export function planCampaign(raw: Inputs): VariantT[] {
  const {campaign: c, product: p} = validateInputs(raw);
  const claims = p.claims.filter(x => x.approved && x.language === c.language);
  if (!claims.length) throw new Error('NO_APPROVED_LOCALIZED_CLAIMS');
  if (c.evidence === 'REAL_DATA' && claims.some(x => /real_data|test_fixture|not_real_product_data/i.test(x.text)))
    throw new Error('INTERNAL_MARKER_IN_CONSUMER_COPY');
  const translations: Record<string, [string, string, string]> = {
    'pt-BR': ['Conheça o produto', 'Veja os detalhes', 'Explore o catálogo'],
    'en-US': ['Discover the product', 'See the details', 'Explore the catalog'],
    es: ['Descubre el producto', 'Mira los detalles', 'Explora el catálogo'],
  };
  const hooks = translations[c.language];
  if (!hooks) throw new Error('LANGUAGE_NOT_SUPPORTED');
  const disclosures: Record<string, {mock: string; affiliate: string; seller: string}> = {
    'pt-BR': {mock: 'MOCK · Produto fictício · Sem oferta real', affiliate: 'Publicidade · Link de afiliado', seller: 'Publicidade'},
    'en-US': {mock: 'MOCK · Fictional product · No real offer', affiliate: 'Advertisement · Affiliate link', seller: 'Advertisement'},
    es: {mock: 'MOCK · Producto ficticio · Sin oferta real', affiliate: 'Publicidad · Enlace de afiliado', seller: 'Publicidad'},
  };
  const labels = disclosures[c.language]!;
  const disclosure = c.evidence === 'MOCK' ? labels.mock : c.commerce_type === 'AFFILIATE' ? labels.affiliate : labels.seller;
  const factual = claims.map(x => x.text).join(' · ');
  return (['discovery', 'features', 'catalog'] as const).map((format, k) => CreativeVariant.parse({
    campaign_id: c.campaign_id, creative_id: `${c.campaign_id}-${format}`, format,
    script: `${hooks[k]}. ${factual}.`, caption: `${disclosure}. ${factual}.`,
    on_screen_text: [hooks[k], claims[0]!.text, hooks[(k + 1) % 3]], claim_refs: claims.map(x => x.claim_id),
    duration_s: 18, faceless: true, commercial_disclosure: disclosure,
  }));
}
export const GovernanceSchema = z.object({human_approved_fingerprint: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  qc_pass: z.boolean(), category_status: z.enum(['ALLOWED', 'UNKNOWN', 'BLOCKED']), commercial_policy_verified: z.boolean(),
  ai_disclosure_required: z.boolean().nullable(), ai_disclosure_present: z.boolean(),
  publication_limit_remaining: z.number().int().nonnegative().safe().nullable(), api_authorized: z.boolean(),
  publication_assets: z.array(z.object({creative_id: Id, kind: z.enum(['VIDEO', 'STATIC_AD']),
    sha256: z.string().regex(/^[a-f0-9]{64}$/)}).strict()).max(100)}).strict();
export type Governance = z.infer<typeof GovernanceSchema>;
export function publishingDecision(raw: Inputs, variants: VariantT[], g: Governance, now: string) {
  g = GovernanceSchema.parse(g);
  const i = validateInputs(raw);
  const {account: a, product: p, listing: l, offer: o} = i;
  const parsed = variants.map(v => CreativeVariant.parse(v));
  if (!parsed.length || new Set(parsed.map(v => v.creative_id)).size !== parsed.length) throw new Error('INVALID_VARIANTS');
  for (const v of parsed) {
    if (v.campaign_id !== i.campaign.campaign_id) throw new Error('CREATIVE_ISOLATION');
    const expected = planCampaign(i).find(x => x.creative_id === v.creative_id);
    // This bounded first increment permits only deterministic sourced copy, not arbitrary generated claims.
    if (!expected || fingerprint(v) !== fingerprint(expected)) throw new Error('UNSOURCED_CREATIVE');
  }
  const variantIds = new Set(parsed.map(v => v.creative_id));
  if (g.publication_assets.some(a => !variantIds.has(a.creative_id))) throw new Error('PUBLICATION_ASSET_ISOLATION');
  if (new Set(g.publication_assets.map(a => `${a.creative_id}:${a.kind}`)).size !== g.publication_assets.length)
    throw new Error('DUPLICATE_PUBLICATION_ASSET');
  const input_fingerprint = fingerprint({inputs: i, variants: parsed, governance: {...g, human_approved_fingerprint: null}});
  const reasons: string[] = [];
  if (parsed.some(v => ['VIDEO', 'STATIC_AD'].some(kind => !g.publication_assets.some(a => a.creative_id === v.creative_id && a.kind === kind))))
    reasons.push('PUBLICATION_ASSETS_MISSING');
  if (a.promotion_permission !== 'AUTHORIZED' || l.promotion_permission !== 'AUTHORIZED' || (o && o.promotion_permission !== 'AUTHORIZED')) reasons.push('PROMOTION_PERMISSION');
  if (a.eligibility_status !== 'ELIGIBLE' || l.eligibility_status !== 'ELIGIBLE' || (o && o.eligibility_status !== 'ELIGIBLE')) reasons.push('ELIGIBILITY');
  if (l.product_price === null || l.stock_status !== 'AVAILABLE') reasons.push('PRICE_OR_STOCK_UNKNOWN');
  if (!Number.isFinite(Date.parse(now)) || (o && Date.parse(o.expires_at) <= Date.parse(now))) reasons.push('OFFER_EXPIRED_OR_CLOCK_INVALID');
  if (p.assets.some(x => x.license_status === 'UNKNOWN')) reasons.push('ASSET_LICENSE');
  if (g.category_status !== 'ALLOWED') reasons.push('CATEGORY_REVIEW');
  if (!g.commercial_policy_verified) reasons.push('COMMERCIAL_POLICY_REVIEW');
  if (g.ai_disclosure_required === null || (g.ai_disclosure_required && !g.ai_disclosure_present)) reasons.push('AI_DISCLOSURE_REVIEW');
  if (!Number.isSafeInteger(g.publication_limit_remaining) || g.publication_limit_remaining! <= 0) reasons.push('PUBLISHING_LIMIT');
  if (!g.qc_pass) reasons.push('QC');
  if (g.human_approved_fingerprint !== input_fingerprint) reasons.push('HUMAN_APPROVAL');
  if (!g.api_authorized) reasons.push('API_NOT_AUTHORIZED');
  if (i.campaign.evidence === 'MOCK') reasons.push('MOCK_NEVER_REAL_PUBLICATION');
  return {status: reasons.length ? 'BLOCKED' as const : 'PREPARED' as const, reasons, input_fingerprint};
}
export function rankOffers(raw: Inputs[], now: string) {
  if (!Number.isFinite(Date.parse(now))) throw new Error('INVALID_CLOCK');
  const inputs = raw.map(validateInputs);
  const scope = (i: Inputs) => ({account_id: i.account.account_id, affiliate_id: i.campaign.affiliate_id,
    brand_id: i.product.brand_id, market_id: i.campaign.market_id, shop_id: i.listing.shop_id,
    seller_id: i.listing.seller_id, platform_id: i.campaign.platform_id, currency: i.campaign.currency,
    language: i.campaign.language, evidence: i.campaign.evidence});
  if (inputs.some(i => i.account.commerce_type !== 'AFFILIATE')
    || (inputs[0] && inputs.some(i => fingerprint(scope(i)) !== fingerprint(scope(inputs[0]!)))))
    throw new Error('OFFER_RANKING_SCOPE_MISMATCH');
  return inputs.filter(i => i.offer
    && i.account.promotion_permission === 'AUTHORIZED' && i.account.eligibility_status === 'ELIGIBLE'
    && i.offer.promotion_permission === 'AUTHORIZED' && i.offer.eligibility_status === 'ELIGIBLE'
    && i.listing.promotion_permission === 'AUTHORIZED' && i.listing.eligibility_status === 'ELIGIBLE'
    && i.listing.stock_status === 'AVAILABLE' && i.listing.product_price !== null && Date.parse(i.offer.expires_at) > Date.parse(now))
    .map(i => {
      const o = i.offer!;
      const parts = {commission: o.commission.commission_rate / 10000, quality: o.quality, reputation: o.reputation,
        editorial_fit: o.editorial_fit, demonstrability: o.demonstrability, return_safety: o.return_risk === null ? null : 1 - o.return_risk};
      const known = Object.values(parts).filter((x): x is number => x !== null);
      return {...scope(i), campaign_id: i.campaign.campaign_id, product_id: i.product.product_id,
        listing_id: i.listing.listing_id, offer_id: o.offer_id, product_price: i.listing.product_price,
        estimated_commission: commission(i.listing.product_price!, o.commission.commission_rate),
        score: known.reduce((n, x) => n + x, 0) / known.length, data_completeness: known.length / Object.keys(parts).length,
        score_parts: parts, unknown: Object.entries(parts).filter(([, x]) => x === null).map(([k]) => k)};
    }).sort((a, b) => b.score - a.score || a.offer_id.localeCompare(b.offer_id));
}
