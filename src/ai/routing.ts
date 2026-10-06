import type { ModelRoute, ModelRouteInput, ModelRouter } from '../contracts/ports.ts';
import type { ProviderPricing } from '../contracts/schemas.ts';
import { CostEstimator } from '../cost/controls.ts';
import { TOKEN_BUDGETS } from './prompts.ts';

export interface ModelCandidate { provider: string; model: string; tier: ModelRoute['tier'];
  max_context_tokens: number; batch_supported: boolean; pricing: ProviderPricing }
export class CheapFirstModelRouter implements ModelRouter {
  private readonly candidates: ModelCandidate[];
  constructor(candidates: ModelCandidate[]) {
    for (const candidate of candidates) {
      if (candidate.provider !== candidate.pricing.provider || candidate.model !== candidate.pricing.model ||
        !Number.isSafeInteger(candidate.max_context_tokens) || candidate.max_context_tokens < 1) throw new Error('Model/pricing identity or context limit mismatch');
    }
    this.candidates = structuredClone(candidates);
  }
  route(input: ModelRouteInput): ModelRoute {
    if (!Number.isSafeInteger(input.context_size) || input.context_size < 0 || !Number.isFinite(input.max_cost) || input.max_cost < 0) {
      throw new Error('Invalid routing input');
    }
    const estimator = new CostEstimator();
    const tier: ModelRoute['tier'] = input.failed_tiers.includes('CHEAP')
      ? input.failed_tiers.includes('STANDARD') ? 'PREMIUM' : 'STANDARD' : 'CHEAP';
    if (tier === 'PREMIUM' && (!input.premium_allowed || !input.premium_justification?.trim())) throw new Error('Premium escalation not justified');
    const eligible = this.candidates.filter(c => c.tier === tier && c.pricing.currency === input.currency && c.max_context_tokens >= input.context_size &&
      (input.latency_requirement !== 'BATCH' || c.batch_supported)).map(c => ({ c,
        cost: estimator.estimate({ estimated_input_tokens: input.context_size, estimated_cached_input_tokens: 0,
          estimated_output_tokens: TOKEN_BUDGETS[input.task_type], estimated_media_units: 0, currency: c.pricing.currency }, c.pricing).estimated_total_cost,
      })).filter(c => c.cost <= input.max_cost).sort((a, b) => a.cost - b.cost);
    const selected = eligible[0]?.c;
    if (!selected) throw new Error('No eligible model within budget; explicit quality escalation required');
    return { provider: selected.provider, model: selected.model, tier, reason: tier === 'CHEAP'
      ? 'Cheap first; deterministic/cache checks must precede provider routing' : tier === 'STANDARD'
        ? 'Cheap quality check failed' : input.premium_justification! };
  }
}
