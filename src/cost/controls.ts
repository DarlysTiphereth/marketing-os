import { BudgetPolicySchema, ProviderPricingSchema } from '../contracts/schemas.ts';
import type { BudgetPolicy, ProviderPricing } from '../contracts/schemas.ts';

const money = (value: number): number => Math.round((value + Number.EPSILON) * 1e9) / 1e9;
export interface CostEstimateInput {
  estimated_input_tokens: number; estimated_cached_input_tokens: number; estimated_output_tokens: number;
  estimated_media_units: number; currency: ProviderPricing['currency'];
}
export class CostEstimator {
  estimate(input: CostEstimateInput, pricing: ProviderPricing) {
    ProviderPricingSchema.parse(pricing);
    for (const value of [input.estimated_input_tokens, input.estimated_cached_input_tokens, input.estimated_output_tokens]) {
      if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid token estimate');
    }
    if (!Number.isFinite(input.estimated_media_units) || input.estimated_media_units < 0) throw new Error('Invalid media estimate');
    if (input.estimated_cached_input_tokens > input.estimated_input_tokens) throw new Error('Cached tokens exceed input');
    if (input.currency !== pricing.currency) throw new Error('Currency mismatch; exchange rates are not inferred');
    const llm = money(((input.estimated_input_tokens - input.estimated_cached_input_tokens) * pricing.input_unit_price +
      input.estimated_cached_input_tokens * pricing.cached_input_unit_price + input.estimated_output_tokens * pricing.output_unit_price) / pricing.token_unit);
    const media = money(input.estimated_media_units * pricing.media_unit_price);
    return { estimated_llm_cost: llm, estimated_media_cost: media, estimated_total_cost: money(llm + media),
      currency: pricing.currency, pricing_version: pricing.pricing_version };
  }
}
export function evaluateBudget(policy: BudgetPolicy, actualSpend: number, estimatedCost: number, currency: BudgetPolicy['currency']) {
  BudgetPolicySchema.parse(policy);
  if (![actualSpend, estimatedCost].every(n => Number.isFinite(n) && n >= 0)) throw new Error('Invalid budget amount');
  if (currency !== policy.currency) throw new Error('Budget currency mismatch');
  const projected = actualSpend + estimatedCost;
  if (!Number.isFinite(projected)) throw new Error('Invalid projected budget amount');
  const blocked = projected > policy.hard_limit;
  const warned = projected > 0 && (projected >= policy.soft_limit || projected >= policy.hard_limit * policy.warning_threshold);
  const status = blocked ? 'BUDGET_BLOCKED' : warned ? 'WARN' : 'OK';
  return { status, projected_spend: projected, budget_remaining: money(policy.hard_limit - projected),
    premium_allowed: policy.premium_allowed && !blocked && !warned,
    preferred_actions: warned ? ['REUSE', 'CACHE', 'CHEAP'] : ['REUSE', 'DETERMINISTIC', 'CACHE', 'CHEAP'] } as const;
}
export interface CostRouteInput {
  reusable: boolean; deterministic: boolean; cache_hit: boolean; cheap_sufficient: boolean;
  standard_sufficient: boolean; premium_justification: string | null;
  policy: BudgetPolicy; actual_spend: number; estimated_cost: number; currency: BudgetPolicy['currency'];
}
export class CostRouter {
  route(input: CostRouteInput) {
    const budget = evaluateBudget(input.policy, input.actual_spend, input.estimated_cost, input.currency);
    // Even free routes must not silently ignore an already exceeded hard budget.
    if (budget.status === 'BUDGET_BLOCKED') throw new Error('BUDGET_BLOCKED');
    if (input.reusable) return { class: 'FREE', action: 'REUSE', reason: 'Equivalent reusable result available' } as const;
    if (input.deterministic) return { class: 'FREE', action: 'CODE', reason: 'Deterministic code is sufficient' } as const;
    if (input.cache_hit) return { class: 'FREE', action: 'CACHE', reason: 'Versioned cache hit' } as const;
    if (input.cheap_sufficient) return { class: 'CHEAP', action: 'AI', reason: 'Cheap model satisfies quality' } as const;
    if (input.standard_sufficient) return { class: 'STANDARD', action: 'AI', reason: 'Cheap quality insufficient' } as const;
    if (!budget.premium_allowed || !input.premium_justification?.trim()) throw new Error('Premium requires allowed budget and business justification');
    return { class: 'PREMIUM', action: 'AI', reason: input.premium_justification } as const;
  }
}
