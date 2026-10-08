import test from 'node:test';
import assert from 'node:assert/strict';
import {Brand, Product, Shop, CommissionPlan, CreativeVariant, ShoppableVideo, Publication, PerformanceEvent, OrderAttribution,
  type OrderT, type EventT} from '../src/commerce/contracts.ts';
import {commission, estimatedMargin, fingerprint, validateInputs, planCampaign, publishingDecision, rankOffers} from '../src/commerce/engine.ts';
import {affiliatePilot, sellerPilot, REVIEW_REQUIRED} from '../src/commerce/pilots.ts';
import {MockCommerceAdapter, UnsupportedPlatformAdapter} from '../src/commerce/adapter.ts';
import {dashboardHtml, performanceReport} from '../src/commerce/performance.ts';

const hash = 'a'.repeat(64);
const now = '2026-10-08T12:00:00Z';
const mock = () => affiliatePilot(hash);
const seller = () => sellerPilot(Product.parse({...mock().product, evidence: 'REAL_DATA', fixture_labels: null, brand_id: 'grand', product_id: 'real-product',
  name: 'Produto aprovado', claims: [{claim_id: 'name', text: 'Produto aprovado', source_ref: 'Approved product source', approved: true, language: 'pt-BR'}]}));
const order = (mode: 'SELLER' | 'AFFILIATE' = 'AFFILIATE'): OrderT => {
  const c = (mode === 'SELLER' ? seller() : mock()).campaign;
  const base = {...c, order_id: 'order-1', creative_id: `${c.campaign_id}-discovery`, source_ref: 'Synthetic test observation',
    status: 'CONFIRMED', gmv: 3000};
  const {seller_id: _s, affiliate_id: _a, offer_id: _o, objective: _b, estimated_margin: _m, ...context} = base;
  return OrderAttribution.parse(mode === 'SELLER' ? {...context, net_revenue: 2800, cost: 1600, refund: 100, commission: null}
    : {...context, net_revenue: null, cost: null, refund: null, commission: 300});
};
const event = (): EventT => {
  const {listing_id: _l, seller_id: _s, affiliate_id: _a, offer_id: _o, objective: _b, estimated_margin: _m, ...c} = mock().campaign;
  return PerformanceEvent.parse({...c, event_id: 'event-1', creative_id: `${c.campaign_id}-discovery`, observed_at: now,
    source_ref: 'Synthetic snapshot', views: 100, clicks: 10, conversions: 1, retention: 0.5});
};

test('commerce: contracts reject unsafe IDs, credentials and invalid rates', () => {
  assert.throws(() => Brand.parse({brand_id: '../brand', name: 'x', evidence: 'MOCK'}));
  assert.throws(() => Product.parse({...mock().product, token: 'secret'}));
  assert.throws(() => CommissionPlan.parse({...mock().offer!.commission, commission_rate: 10001}));
  assert.ok(Shop.parse({shop_id: 'mock-shop', seller_id: 'mock-seller', market_id: 'br', platform_id: 'tiktok-shop', evidence: 'MOCK'}));
});
test('commerce: seller cannot reuse affiliate identity or offer', () => {
  const i = seller(); i.account = mock().account;
  assert.throws(() => validateInputs(i), /ISOLATION/);
  assert.throws(() => validateInputs({...seller(), offer: mock().offer}), /SELLER_ISOLATION/);
});
for (const key of ['brand_id', 'product_id', 'shop_id', 'market_id', 'currency', 'language', 'listing_id', 'evidence'] as const) {
  test(`commerce: listing ${key} isolation`, () => {
    const i = mock(); (i.listing as Record<string, unknown>)[key] = key === 'currency' ? 'USD' : key === 'language' ? 'en-US' : key === 'evidence' ? 'REAL_DATA' : 'other';
    assert.throws(() => validateInputs(i), /ISOLATION/);
  });
}
test('commerce: affiliate offer cannot cross account, currency or evidence', () => {
  for (const mutate of [(i: ReturnType<typeof mock>) => {i.offer!.affiliate_id = 'other';},
    (i: ReturnType<typeof mock>) => {i.offer!.commission.currency = 'USD';},
    (i: ReturnType<typeof mock>) => {i.offer!.commission.evidence = 'REAL_DATA';}]) {
    const i = mock(); mutate(i); assert.throws(() => validateInputs(i), /AFFILIATE_ISOLATION/);
  }
});
test('commerce: integer commission floors correctly and rejects invalid money', () => {
  assert.equal(commission(3000, 1000), 300); assert.equal(commission(999, 1250), 124);
  assert.equal(commission(Number.MAX_SAFE_INTEGER, 10000), Number.MAX_SAFE_INTEGER);
  for (const n of [-1, 0.1, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => commission(n, 1000));
});
test('commerce: margins require every cost, preserve negative margins, reject overflow', () => {
  assert.equal(estimatedMargin(3000, [1000, 200, 100]), 1700);
  assert.equal(estimatedMargin(100, [200]), -100);
  assert.equal(estimatedMargin(null, [100]), null); assert.equal(estimatedMargin(3000, [1000, null]), null);
  assert.equal(estimatedMargin(3000, []), null); assert.throws(() => estimatedMargin(3000, [-1]));
  assert.throws(() => estimatedMargin(0, [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]));
});
test('commerce: three deterministic distinct variants with only sourced copy', () => {
  const vs = planCampaign(mock()); assert.equal(vs.length, 3);
  assert.equal(new Set(vs.map(v => v.script)).size, 3);
  assert.deepEqual(vs, planCampaign(mock())); vs.forEach(v => {assert.ok(CreativeVariant.parse(v)); assert.ok(v.caption.includes('MOCK'));});
});
test('commerce: REAL_DATA remains internal in all consumer copy', () => {
  const vs = planCampaign(seller()); assert.equal(vs.length, 3);
  for (const v of vs) assert.doesNotMatch([v.script, v.caption, ...v.on_screen_text, v.commercial_disclosure].join(' '), /REAL_DATA|NOT_REAL_PRODUCT_DATA|TEST_FIXTURE/);
  assert.equal(publishingDecision(seller(), vs, REVIEW_REQUIRED, now).status, 'BLOCKED');
});
test('commerce: source data cannot smuggle internal metadata into real consumer copy', () => {
  for (const text of ['REAL_DATA', 'tEsT_fIxTuRe', 'NOT_REAL_PRODUCT_DATA']) {
    const i = seller(); i.product.claims[0]!.text = text;
    assert.throws(() => planCampaign(i), /INTERNAL_MARKER/);
  }
});
test('commerce: unapproved or unavailable translations cannot generate', () => {
  const i = mock(); i.product.claims.forEach(c => {c.approved = false;}); assert.throws(() => planCampaign(i), /NO_APPROVED/);
  const en = mock(); en.campaign.language = en.listing.language = en.offer!.language = 'en-US';
  assert.throws(() => planCampaign(en), /NO_APPROVED_LOCALIZED/);
  en.product.claims = [{claim_id: 'translated', text: 'Fictional cloth', source_ref: 'Approved mock translation', approved: true, language: 'en-US'}];
  assert.match(planCampaign(en)[0]!.script, /Discover/);
  assert.match(planCampaign(en)[0]!.caption, /Fictional product/);
  en.campaign.language = en.listing.language = en.offer!.language = 'es';
  en.product.claims = [{claim_id: 'translated', text: 'Paño ficticio', source_ref: 'Approved mock translation', approved: true, language: 'es'}];
  assert.match(planCampaign(en)[0]!.caption, /Producto ficticio/);
});
test('commerce: revoked, expired, unknown stock and unavailable offers are excluded', () => {
  assert.equal(rankOffers([mock()], now).length, 1);
  for (const mutate of [(i: ReturnType<typeof mock>) => {i.offer!.promotion_permission = 'REVOKED';},
    (i: ReturnType<typeof mock>) => {i.offer!.expires_at = now;}, (i: ReturnType<typeof mock>) => {i.listing.stock_status = 'UNKNOWN';},
    (i: ReturnType<typeof mock>) => {i.account.eligibility_status = 'BLOCKED';}, (i: ReturnType<typeof mock>) => {i.listing.product_price = null;}]) {
    const i = mock(); mutate(i); assert.equal(rankOffers([i], now).length, 0);
  }
  const r = rankOffers([mock()], now)[0]!; assert.equal(r.estimated_commission, 300);
  assert.deepEqual(r.unknown, ['quality', 'reputation', 'return_safety']); assert.equal(r.evidence, 'MOCK');
});
test('commerce: independent-review P1 ranking rejects mixed caller scopes and retains ownership', () => {
  const changes = [
    (i: ReturnType<typeof mock>) => {i.account.account_id = i.campaign.account_id = 'other'; if (i.account.commerce_type === 'AFFILIATE') i.account.affiliate_id = 'other'; i.campaign.affiliate_id = i.offer!.affiliate_id = 'other';},
    (i: ReturnType<typeof mock>) => {i.product.brand_id = i.campaign.brand_id = i.listing.brand_id = i.offer!.brand_id = 'other';},
    (i: ReturnType<typeof mock>) => {i.account.market_id = i.campaign.market_id = i.listing.market_id = i.offer!.market_id = 'us';},
    (i: ReturnType<typeof mock>) => {i.campaign.shop_id = i.listing.shop_id = i.offer!.shop_id = 'other';},
    (i: ReturnType<typeof mock>) => {i.campaign.currency = i.listing.currency = i.offer!.currency = i.offer!.commission.currency = 'USD';},
    (i: ReturnType<typeof mock>) => {i.campaign.language = i.listing.language = i.offer!.language = 'en-US';},
    (i: ReturnType<typeof mock>) => {i.account.platform_id = i.campaign.platform_id = i.listing.platform_id = i.offer!.platform_id = 'instagram';},
  ];
  for (const change of changes) {const i = mock(); change(i); assert.ok(validateInputs(i)); assert.throws(() => rankOffers([mock(), i], now), /OFFER_RANKING_SCOPE_MISMATCH/);}
  const row = rankOffers([mock()], now)[0]!;
  assert.equal(row.account_id, 'mock-affiliate'); assert.equal(row.affiliate_id, 'mock-affiliate');
  assert.equal(row.brand_id, 'mock-home'); assert.equal(row.market_id, 'br'); assert.equal(row.shop_id, 'mock-shop');
});
test('commerce: independent-review P1 mock fixtures require exact metadata markers, never real data', () => {
  assert.deepEqual(mock().product.fixture_labels, ['TEST_FIXTURE', 'NOT_REAL_PRODUCT_DATA']);
  const {fixture_labels: _labels, ...unmarked} = mock().product;
  assert.throws(() => Product.parse(unmarked));
  assert.throws(() => Product.parse({...mock().product, fixture_labels: null}));
  assert.throws(() => Product.parse({...seller().product, fixture_labels: ['TEST_FIXTURE', 'NOT_REAL_PRODUCT_DATA']}));
  assert.equal(seller().product.fixture_labels, null);
});
test('commerce: independent-review scoring keeps unknown data separate from measured score', () => {
  const row = rankOffers([mock()], now)[0]!;
  assert.ok(Math.abs(row.score - (0.1 + 0.8 + 0.7) / 3) < 1e-10);
  assert.equal(row.data_completeness, 0.5); assert.equal(row.score_parts.quality, null);
});
test('commerce: publication cannot infer account permission, price, policy or human approval', () => {
  const result = publishingDecision(seller(), planCampaign(seller()), REVIEW_REQUIRED, now);
  for (const reason of ['PROMOTION_PERMISSION', 'ELIGIBILITY', 'PRICE_OR_STOCK_UNKNOWN', 'CATEGORY_REVIEW', 'QC', 'HUMAN_APPROVAL', 'API_NOT_AUTHORIZED']) assert.ok(result.reasons.includes(reason));
});
test('commerce: runtime governance rejects truthy strings, invalid counters and unexpected authorization fields', () => {
  for (const g of [{...REVIEW_REQUIRED, qc_pass: 'false'}, {...REVIEW_REQUIRED, api_authorized: 'no'},
    {...REVIEW_REQUIRED, publication_limit_remaining: -1}, {...REVIEW_REQUIRED, bypass: true}]) {
    assert.throws(() => publishingDecision(mock(), planCampaign(mock()), g as unknown as typeof REVIEW_REQUIRED, now));
  }
});
test('commerce: copy injection or variant from another campaign cannot pass governance', () => {
  const vs = planCampaign(mock()); vs[0]!.script = 'Guaranteed results';
  assert.throws(() => publishingDecision(mock(), vs, REVIEW_REQUIRED, now), /UNSOURCED_CREATIVE/);
  assert.throws(() => publishingDecision(mock(), planCampaign(seller()), REVIEW_REQUIRED, now), /CREATIVE_ISOLATION/);
});
test('commerce: identical approvals are stable; product, policy and variants invalidate approval', () => {
  const i = seller(); i.account.eligibility_status = i.listing.eligibility_status = 'ELIGIBLE';
  i.product.assets.forEach(a => {a.license_status = 'OWNED';});
  i.account.promotion_permission = i.listing.promotion_permission = 'AUTHORIZED'; i.listing.product_price = 3000; i.listing.stock_status = 'AVAILABLE';
  const g = {...REVIEW_REQUIRED, category_status: 'ALLOWED' as const, commercial_policy_verified: true,
    ai_disclosure_required: false, publication_limit_remaining: 1, api_authorized: true, qc_pass: true,
    publication_assets: planCampaign(i).flatMap(v => (['VIDEO', 'STATIC_AD'] as const).map(kind => ({creative_id: v.creative_id, kind, sha256: hash})))};
  const vs = planCampaign(i); const approved = publishingDecision(i, vs, g, now).input_fingerprint;
  const signed = {...g, human_approved_fingerprint: approved};
  assert.equal(publishingDecision(i, vs, signed, now).status, 'PREPARED');
  assert.equal(publishingDecision(i, vs, signed, now).input_fingerprint, approved);
  i.product.version = 'new-version'; assert.equal(publishingDecision(i, vs, signed, now).status, 'BLOCKED');
  assert.ok(publishingDecision(i, vs, {...signed, category_status: 'BLOCKED'}, now).reasons.includes('CATEGORY_REVIEW'));
});
test('commerce: mock never grants real publication, even with simulated authorization', () => {
  assert.ok(publishingDecision(mock(), planCampaign(mock()), {...REVIEW_REQUIRED, api_authorized: true}, now).reasons.includes('MOCK_NEVER_REAL_PUBLICATION'));
  assert.throws(() => new MockCommerceAdapter(seller()), /REJECTS_REAL_DATA/);
});
test('commerce: independent-review approval binds exact video/static hashes and refuses missing or crossed assets', () => {
  const i = seller(), vs = [planCampaign(i)[0]!];
  const g = {...REVIEW_REQUIRED, qc_pass: true, publication_assets: [
    {creative_id: vs[0]!.creative_id, kind: 'VIDEO' as const, sha256: hash},
    {creative_id: vs[0]!.creative_id, kind: 'STATIC_AD' as const, sha256: hash}]};
  const signed = {...g, human_approved_fingerprint: publishingDecision(i, vs, g, now).input_fingerprint};
  assert.ok(!publishingDecision(i, vs, signed, now).reasons.includes('HUMAN_APPROVAL'));
  for (const index of [0, 1]) {
    const changed = structuredClone(signed); changed.publication_assets[index]!.sha256 = 'b'.repeat(64);
    assert.ok(publishingDecision(i, vs, changed, now).reasons.includes('HUMAN_APPROVAL'));
  }
  assert.ok(publishingDecision(i, vs, {...signed, publication_assets: []}, now).reasons.includes('PUBLICATION_ASSETS_MISSING'));
  assert.throws(() => publishingDecision(i, vs, {...signed, publication_assets: [{creative_id: 'other', kind: 'VIDEO', sha256: hash}]}, now), /ASSET_ISOLATION/);
});
test('commerce: every live adapter method explicitly unavailable; no network capability', () => {
  const a = new UnsupportedPlatformAdapter(), vs = planCampaign(seller());
  const results = [a.validateAccount(), a.validateProduct(), a.getProductCatalog(), a.getAffiliateOffers(),
    a.prepareShoppableAsset(vs), a.checkPublishingEligibility(vs, REVIEW_REQUIRED, now), a.publishWhenAuthorized(vs, REVIEW_REQUIRED, now), a.getPerformance(), a.getAttributedSales()];
  assert.ok(results.every(r => r.status === 'NOT_SUPPORTED'));
});
test('commerce: simulator scopes catalog and never publishes or invents observations', () => {
  const i = mock(), a = new MockCommerceAdapter(i); i.product.name = 'tampered outside';
  assert.equal(a.getProductCatalog().status, 'SIMULATED');
  assert.equal(a.getAffiliateOffers().status, 'SIMULATED');
  assert.equal(a.prepareShoppableAsset(planCampaign(mock())).status, 'SIMULATED');
  assert.match(JSON.stringify(a.publishWhenAuthorized(planCampaign(mock()), REVIEW_REQUIRED, now)), /"published":false/);
  assert.match(JSON.stringify(a.getPerformance()), /NO_OBSERVATIONS/);
});
test('commerce: seller revenue is independent of attributed affiliate GMV and commissions', () => {
  const s = performanceReport(seller().campaign, [order('SELLER')], []);
  assert.equal(s.seller!.gmv, 3000); assert.equal(s.seller!.net_revenue, 2700); assert.equal(s.seller!.margin, 1100); assert.equal(s.affiliate, null);
  const a = performanceReport(mock().campaign, [order()], []);
  assert.equal(a.affiliate!.confirmed_commissions, 300); assert.equal(a.seller, null);
  assert.throws(() => performanceReport(seller().campaign, [order()], []), /ISOLATION/);
});
test('commerce: cancellations never produce confirmed commission; duplicate orders rejected', () => {
  const o = order(); o.status = 'CANCELLED';
  const r = performanceReport(mock().campaign, [o], []); assert.equal(r.affiliate!.cancelled_orders, 1);
  assert.ok(!r.affiliate!.confirmed_commissions);
  assert.throws(() => performanceReport(mock().campaign, [order(), order()], []), /DUPLICATE_ORDER/);
});
test('commerce: no observations remain unknown; cumulative events do not double count', () => {
  assert.equal(performanceReport(seller().campaign, [], []).seller!.gmv, null);
  const e = event(), later = {...e, event_id: 'event-2', observed_at: '2026-10-09T12:00:00Z', views: 200};
  const r = performanceReport(mock().campaign, [], [e, later]); assert.equal(r.creative.length, 1); assert.equal(r.creative[0]!.views, 200);
  assert.equal(r.creative[0]!.ctr, 0.05); assert.equal(r.creative[0]!.validation_status, 'NOT_VALIDATED_BY_CONTROLLED_EXPERIMENT');
  assert.throws(() => performanceReport(mock().campaign, [], [e, e]), /DUPLICATE_EVENT/);
  assert.throws(() => PerformanceEvent.parse({...e, clicks: 101}));
});
test('commerce: dashboard exposes all seven filters and safely embeds untrusted data', () => {
  const report = performanceReport(mock().campaign, [], []);
  report.creative.push({creative_id: '</script><script>evil</script>', views: null, clicks: null, retention: null,
    conversions: null, ctr: null, conversion_rate: null, validation_status: 'NOT_VALIDATED_BY_CONTROLLED_EXPERIMENT'});
  const html = dashboardHtml([report]); assert.doesNotMatch(html, /<script>evil/);
  for (const k of ['brand_id', 'product_id', 'market_id', 'language', 'channel', 'campaign_id', 'commerce_type']) assert.ok(html.includes(k));
});
test('commerce: media contracts cannot call an unattached real Shop video supported', () => {
  const v = {creative_id: 'creative', campaign_id: 'campaign', listing_id: 'listing', sha256: hash,
    width: 1080, height: 1920, duration_s: 18, qc_status: 'PASS', attachment_status: 'NOT_SUPPORTED', evidence: 'REAL_DATA'};
  assert.ok(ShoppableVideo.parse(v)); assert.throws(() => ShoppableVideo.parse({...v, attachment_status: 'PUBLISHED'}));
  assert.throws(() => Publication.parse({...mock().campaign, status: 'PUBLISHED'}));
});
test('commerce: fingerprints canonicalize object order without masking input changes', () => {
  assert.equal(fingerprint({a: 1, b: 2}), fingerprint({b: 2, a: 1}));
  assert.notEqual(fingerprint({a: 1}), fingerprint({a: 2}));
});
test('commerce: second review rejects duplicate claim/asset IDs before planning', () => {
  const i = mock(); i.product.claims.push({...i.product.claims[0]!, text: 'Ambiguous source'});
  assert.throws(() => Product.parse(i.product), /DUPLICATE_PRODUCT_CHILD_ID/);
  const j = mock(); j.product.assets.push({...j.product.assets[0]!, sha256: 'b'.repeat(64)});
  assert.throws(() => Product.parse(j.product), /DUPLICATE_PRODUCT_CHILD_ID/);
});
test('commerce: second review converts only a subset of known clicked visits', () => {
  assert.throws(() => PerformanceEvent.parse({...event(), conversions: 11}), /CONVERSIONS_EXCEED_CLICKS/);
  assert.throws(() => PerformanceEvent.parse({...event(), clicks: 0, conversions: 1}), /CONVERSIONS_EXCEED_CLICKS/);
  assert.ok(PerformanceEvent.parse({...event(), clicks: null, conversions: null}));
});
test('commerce: second review publication records enforce approval and blocking state', () => {
  const c = seller().campaign;
  const {seller_id: _s, affiliate_id: _a, listing_id: _l, offer_id: _o, objective: _b, estimated_margin: _m, ...context} = c;
  const record = {...context, publication_id: 'publication', creative_id: `${c.campaign_id}-discovery`,
    status: 'PREPARED', human_approved: true, reasons: [], input_fingerprint: hash};
  assert.ok(Publication.parse(record));
  assert.throws(() => Publication.parse({...record, human_approved: false}), /CONTRADICTORY_PUBLICATION_STATE/);
  assert.throws(() => Publication.parse({...record, reasons: ['CATEGORY_REVIEW']}), /CONTRADICTORY_PUBLICATION_STATE/);
  assert.throws(() => Publication.parse({...record, status: 'BLOCKED'}), /CONTRADICTORY_PUBLICATION_STATE/);
  assert.throws(() => Publication.parse({...record, status: 'SIMULATED'}), /CONTRADICTORY_PUBLICATION_STATE/);
});
