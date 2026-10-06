import { AssetRecordSchema } from '../contracts/schemas.ts';
import type { AssetRecord } from '../contracts/schemas.ts';

export class AssetRegistry {
  private readonly records: AssetRecord[];
  constructor(records: AssetRecord[]) {
    this.records = records.map(record => AssetRecordSchema.parse(record));
    if (new Set(this.records.map(r => r.asset_id)).size !== this.records.length) throw new Error('Duplicate asset IDs');
  }
  lookup(brandId: string, productId: string, type: AssetRecord['asset_type']): AssetRecord[] {
    return this.records.filter(r => r.brand_id === brandId && r.product_id === productId && r.asset_type === type && r.faceless_verified)
      .map(r => structuredClone(r));
  }
  reuse(assetId: string, brandId: string, productId: string): void {
    const record = this.records.find(r => r.asset_id === assetId && r.brand_id === brandId && r.product_id === productId);
    if (!record || !record.faceless_verified) throw new Error('Asset missing, unverified, or belongs to another brand/product');
    record.usage_count++;
  }
  snapshot(): AssetRecord[] { return structuredClone(this.records); }
}
