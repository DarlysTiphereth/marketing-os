import type { CacheRepository } from '../contracts/ports.ts';
import { hash } from '../domain/identity.ts';

export interface CacheKeyInput { task_type: string; normalized_input: unknown; brand_id: string; product_id: string;
  brand_version: string; product_version: string; prompt_version: string; skill_version: string; model_family: string }
export function cacheKey(input: CacheKeyInput): string {
  return hash({ ...input, normalized_input: hash(input.normalized_input) });
}
export class VersionedCache {
  private readonly repository: CacheRepository;
  constructor(repository: CacheRepository) { this.repository = repository; }
  async get(input: CacheKeyInput) {
    const key = cacheKey(input);
    const entry = await this.repository.get(key);
    return { value: entry?.value ?? null, cache_hit: entry !== null, cache_key: key, cache_created_at: entry?.created_at ?? null };
  }
  async put(input: CacheKeyInput, value: unknown, now: string): Promise<void> {
    await this.repository.put(cacheKey(input), value, now);
  }
}
export class MemoryCache implements CacheRepository {
  private readonly entries = new Map<string, { value: unknown; created_at: string }>();
  async get(key: string) { return structuredClone(this.entries.get(key) ?? null); }
  async put(key: string, value: unknown, created_at: string) { this.entries.set(key, structuredClone({ value, created_at })); }
}
