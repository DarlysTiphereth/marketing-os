import type { CreativeVariant } from '../contracts/schemas.ts';
const transitions: Record<CreativeVariant['status'], CreativeVariant['status'][]> = {
  DRAFT: ['PLANNED', 'BLOCKED'], PLANNED: ['QA_REVIEW', 'BLOCKED'],
  QA_REVIEW: ['READY_FOR_PRODUCTION', 'BLOCKED'], READY_FOR_PRODUCTION: [], BLOCKED: [],
};
export function transition(creative: CreativeVariant, next: CreativeVariant['status'], now: string): CreativeVariant {
  if (!transitions[creative.status].includes(next)) throw new Error(`Invalid transition: ${creative.status} -> ${next}`);
  return { ...creative, status: next, updated_at: now };
}
