import {publishingDecision, validateInputs, type Governance, type Inputs} from './engine.ts';
import type {VariantT} from './contracts.ts';

export type AdapterResult = {status: 'NOT_SUPPORTED'; reason: string} |
  {status: 'SIMULATED'; data: unknown; evidence: 'MOCK'};
export interface CommercePlatformAdapter {
  validateAccount(): AdapterResult;
  validateProduct(): AdapterResult;
  getProductCatalog(): AdapterResult;
  getAffiliateOffers(): AdapterResult;
  prepareShoppableAsset(variants: VariantT[]): AdapterResult;
  checkPublishingEligibility(variants: VariantT[], governance: Governance, now: string): AdapterResult;
  publishWhenAuthorized(variants: VariantT[], governance: Governance, now: string): AdapterResult;
  getPerformance(): AdapterResult;
  getAttributedSales(): AdapterResult;
}
// No SDK, tokens, HTTP requests, guessed endpoints or implicit account authorization.
export class UnsupportedPlatformAdapter implements CommercePlatformAdapter {
  private unavailable(): AdapterResult { return {status: 'NOT_SUPPORTED', reason: 'Official application, scopes and account authorization have not been verified.'}; }
  validateAccount() { return this.unavailable(); }
  validateProduct() { return this.unavailable(); }
  getProductCatalog() { return this.unavailable(); }
  getAffiliateOffers() { return this.unavailable(); }
  prepareShoppableAsset(_variants: VariantT[]) { return this.unavailable(); }
  checkPublishingEligibility(_variants: VariantT[], _g: Governance, _now: string) { return this.unavailable(); }
  publishWhenAuthorized(_variants: VariantT[], _g: Governance, _now: string) { return this.unavailable(); }
  getPerformance() { return this.unavailable(); }
  getAttributedSales() { return this.unavailable(); }
}
export class MockCommerceAdapter implements CommercePlatformAdapter {
  private readonly inputs: Inputs;
  constructor(raw: Inputs) {
    this.inputs = validateInputs(structuredClone(raw));
    if (this.inputs.campaign.evidence !== 'MOCK') throw new Error('MOCK_ADAPTER_REJECTS_REAL_DATA');
  }
  private result(data: unknown): AdapterResult { return {status: 'SIMULATED', evidence: 'MOCK', data: structuredClone(data)}; }
  validateAccount() { return this.result(this.inputs.account); }
  validateProduct() { return this.result(this.inputs.product); }
  getProductCatalog() { return this.result([this.inputs.product]); }
  getAffiliateOffers() { return this.result(this.inputs.offer ? [this.inputs.offer] : []); }
  prepareShoppableAsset(variants: VariantT[]) {
    const result = publishingDecision(this.inputs, variants, {human_approved_fingerprint: null, qc_pass: false,
      category_status: 'UNKNOWN', commercial_policy_verified: false, ai_disclosure_required: null,
      ai_disclosure_present: false, publication_limit_remaining: null, api_authorized: false}, new Date().toISOString());
    return this.result({listing_id: this.inputs.listing.listing_id, creative_ids: variants.map(v => v.creative_id), ...result});
  }
  checkPublishingEligibility(variants: VariantT[], g: Governance, now: string) {
    return this.result(publishingDecision(this.inputs, variants, g, now));
  }
  publishWhenAuthorized(variants: VariantT[], g: Governance, now: string) {
    // Only exercise the gate; this simulator never sends anything or asserts a real publication.
    return this.result({...publishingDecision(this.inputs, variants, g, now), published: false});
  }
  getPerformance() { return this.result({events: [], status: 'NO_OBSERVATIONS'}); }
  getAttributedSales() { return this.result({orders: [], status: 'NO_OBSERVATIONS'}); }
}
