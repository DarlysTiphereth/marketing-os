import type { ProductKnowledge, SourcedFact } from '../contracts/schemas.ts';
import type { SourceRepository } from '../contracts/ports.ts';
import { contentHash } from './identity.ts';

export function facts(product: ProductKnowledge): SourcedFact[] {
  return [...(product.official_description ? [product.official_description] : []), ...product.confirmed_features,
    ...product.confirmed_benefits, ...product.usage_instructions, ...product.warnings];
}
export function assertSupportedClaim(claim: SourcedFact, product: ProductKnowledge): void {
  const sourceIds = new Set(product.source_references.map(source => source.source_id));
  if (!claim.source_ids.length || claim.source_ids.some(id => !sourceIds.has(id))) throw new Error('NO SOURCE -> NO CLAIM');
  const match = facts(product).find(fact => fact.text === claim.text);
  if (!match || claim.source_ids.some(id => !match.source_ids.includes(id))) throw new Error(`Unsupported claim: ${claim.text}`);
  if (product.prohibited_claims.some(pattern => claim.text.toLocaleLowerCase().includes(pattern.toLocaleLowerCase()))) {
    throw new Error(`Prohibited claim: ${claim.text}`);
  }
}
export async function validateProvenance(product: ProductKnowledge, sources: SourceRepository): Promise<void> {
  if (new Set(product.source_references.map(s => s.source_id)).size !== product.source_references.length) {
    throw new Error('Duplicate source IDs');
  }
  if (product.data_label === 'TEST_FIXTURE' && (!product.data_notice.includes('NOT_REAL_PRODUCT_DATA') ||
    product.knowledge_status !== 'TEST_FIXTURE' || product.source_references.some(s => s.source_type !== 'TEST_FIXTURE'))) {
    throw new Error('Fixture labeling/provenance is inconsistent');
  }
  if (product.data_label === 'REAL_DATA' && product.source_references.some(s => s.source_type === 'TEST_FIXTURE')) {
    throw new Error('Real product cannot cite test fixtures');
  }
  for (const source of product.source_references) {
    const content = await sources.read(source);
    if (contentHash(content) !== source.source_hash) throw new Error(`Source hash mismatch: ${source.source_id}`);
    const evidence: unknown = JSON.parse(content);
    if (!evidence || typeof evidence !== 'object' || !('brand_id' in evidence) || !('product_id' in evidence) ||
      evidence.brand_id !== product.brand_id || evidence.product_id !== product.product_id) throw new Error('Source brand/product mismatch');
    for (const fact of facts(product).filter(f => f.source_ids.includes(source.source_id))) {
      if (!('facts' in evidence) || !Array.isArray(evidence.facts) || !evidence.facts.includes(fact.text)) {
        throw new Error(`Source does not support fact: ${fact.text}`);
      }
    }
  }
  for (const fact of facts(product)) assertSupportedClaim(fact, product);
}
