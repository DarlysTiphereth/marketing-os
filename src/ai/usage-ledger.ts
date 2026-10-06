import { AIUsageRecordSchema } from '../contracts/schemas.ts';
import type { AIUsageRecord } from '../contracts/schemas.ts';

export class AIUsageLedger {
  private readonly records = new Map<string, AIUsageRecord>();
  append(raw: AIUsageRecord): void {
    const record = AIUsageRecordSchema.parse(raw);
    if (this.records.has(record.usage_id)) throw new Error('Duplicate usage ID');
    this.records.set(record.usage_id, record);
  }
  list(brandId: string, productId: string): AIUsageRecord[] {
    return structuredClone([...this.records.values()].filter(r => r.brand_id === brandId && r.product_id === productId));
  }
}
