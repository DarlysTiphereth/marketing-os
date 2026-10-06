import { readFile, writeFile, mkdir, readdir, rename, rm, realpath } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AssetRecordSchema, BatchArtifactsSchema, BatchSchema, BrandContextSchema, Hash, ProductKnowledgeSchema,
  ProviderPricingSchema, Slug, UUID } from '../contracts/schemas.ts';
import type { BatchArtifacts, SourceReference } from '../contracts/schemas.ts';
import type { CacheRepository, Repositories } from '../contracts/ports.ts';
import { contentHash, hash } from '../domain/identity.ts';

const DOCUMENTS = ['batch.json', 'brand-context.json', 'product-knowledge.json', 'strategy.json', 'generation-matrix.json',
  'variants.json', 'compliance-decision.json', 'qa-report.json', 'cost-report.json', 'efficiency-report.json',
  'execution-summary.json', 'asset-registry.json', 'usage-ledger.json'];

export function inside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
export function safePath(root: string, relative: string): string {
  if (path.isAbsolute(relative)) throw new Error('Absolute source/output paths are not allowed');
  const target = path.resolve(root, relative);
  if (!inside(root, target)) throw new Error('Path escapes repository');
  return target;
}
export class FilesystemRepositories {
  readonly root: string;
  readonly outputRoot: string;
  readonly repositories: Repositories;
  readonly cache: CacheRepository;
  constructor(root: string, output = 'outputs') {
    this.root = path.resolve(root);
    this.outputRoot = safePath(this.root, output);
    if (this.outputRoot === this.root) throw new Error('Output must be a separate directory');
    this.repositories = {
      brands: { get: async brandId => {
        Slug.parse(brandId);
        const brand = await this.read(`brands/${brandId}/context.json`, BrandContextSchema);
        if (brand.brand_id !== brandId) throw new Error('Brand repository identity mismatch');
        return brand;
      } },
      products: { get: async (brandId, productId) => {
        Slug.parse(brandId); Slug.parse(productId);
        const product = await this.read(`products/${brandId}/${productId}.json`, ProductKnowledgeSchema);
        if (product.brand_id !== brandId || product.product_id !== productId) throw new Error('Product repository identity mismatch');
        return product;
      } },
      sources: { read: source => this.readSource(source) },
      assets: { list: async (brandId, productId) => {
        Slug.parse(brandId); Slug.parse(productId);
        const records = await this.read(`brands/${brandId}/assets.json`, z.array(AssetRecordSchema));
        if (records.some(r => r.brand_id !== brandId)) throw new Error('Asset catalog brand mismatch');
        const selected = records.filter(r => r.product_id === productId);
        for (const asset of selected) {
          const content = await this.readText(asset.source);
          if (contentHash(content) !== asset.content_hash) throw new Error('Asset content hash mismatch');
          const metadata: unknown = JSON.parse(content);
          if (!metadata || typeof metadata !== 'object' || !('brand_id' in metadata) || metadata.brand_id !== brandId ||
            !('product_id' in metadata) || metadata.product_id !== productId) throw new Error('Asset source identity mismatch');
        }
        return selected;
      } },
      batches: {
        findByIdempotencyKey: (brandId, key) => this.find(brandId, key),
        withIdempotencyLock: (brandId, key, work) => this.withLock(brandId, key, work),
        save: artifacts => this.save(artifacts),
      },
      creatives: { get: async (batchId, creativeId) => {
        UUID.parse(creativeId);
        const artifacts = await this.load(batchId);
        const creative = artifacts.variants.find(v => v.creative_id === creativeId);
        if (!creative) throw new Error('Creative not found');
        return creative;
      } },
      usage: { list: async batchId => (await this.load(batchId)).usage },
      pricing: { get: async (provider, model, version) => {
        Slug.parse(provider); Slug.parse(model); Slug.parse(version);
        const pricing = await this.read(`pricing/${provider}/${model}/${version}.json`, ProviderPricingSchema);
        if (pricing.provider !== provider || pricing.model !== model || pricing.pricing_version !== version) throw new Error('Pricing identity mismatch');
        return pricing;
      } },
    };
    this.cache = {
      get: async key => {
        Hash.parse(key);
        try {
          await this.prepareOutput();
          const entry = await this.readOutput(`.cache/${key}.json`, z.object({ value: z.unknown(), created_at: z.string().datetime() }).strict());
          if (!Object.hasOwn(entry, 'value')) throw new Error('Missing cached value');
          return { value: entry.value, created_at: entry.created_at };
        } catch (error) { if (isMissing(error)) return null; throw error; }
      },
      put: async (key, value, created_at) => {
        Hash.parse(key);
        await this.prepareOutput();
        const cacheDir = path.join(this.outputRoot, '.cache');
        await this.checkedMkdir(cacheDir);
        const temporary = path.join(cacheDir, `${key}.${randomUUID()}.tmp`);
        try {
          await writeFile(temporary, JSON.stringify({ value, created_at }, null, 2), { flag: 'wx' });
          await rename(temporary, path.join(cacheDir, `${key}.json`));
        } finally { await rm(temporary, { force: true }); }
      },
    };
  }
  private async checkedMkdir(target: string): Promise<void> {
    // Check existing ancestors before mkdir, preventing traversal through an existing symlink.
    let ancestor = target;
    for (;;) {
      try {
        const resolvedAncestor = await realpath(ancestor);
        const resolvedRoot = await realpath(this.root);
        if (!inside(resolvedRoot, resolvedAncestor)) throw new Error('Symlink escapes repository');
        break;
      } catch (error) {
        if (!isMissing(error)) throw error;
        const parent = path.dirname(ancestor);
        if (parent === ancestor) throw error;
        ancestor = parent;
      }
    }
    await mkdir(target, { recursive: true });
  }
  private async prepareOutput() { await this.checkedMkdir(this.outputRoot); }
  private async readText(relative: string): Promise<string> {
    const target = safePath(this.root, relative);
    const resolved = await realpath(target);
    if (!inside(await realpath(this.root), resolved)) throw new Error('Symlink escapes repository');
    return readFile(resolved, 'utf8');
  }
  private async read<T>(relative: string, schema: z.ZodType<T>): Promise<T> {
    return schema.parse(JSON.parse(await this.readText(relative)));
  }
  private async readOutput<T>(relative: string, schema: z.ZodType<T>): Promise<T> {
    const target = safePath(this.outputRoot, relative);
    return this.read(path.relative(this.root, target), schema);
  }
  private async readSource(source: SourceReference): Promise<string> { return this.readText(source.source_location); }
  private async find(brandId: string, key: string): Promise<BatchArtifacts | null> {
    Slug.parse(brandId);
    await this.prepareOutput();
    for (const entry of await readdir(this.outputRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !UUID.safeParse(entry.name).success) continue;
      const batch = await this.readOutput(`${entry.name}/batch.json`, BatchSchema);
      if (batch.request.brand_id === brandId && batch.request.idempotency_key === key) return this.load(entry.name);
    }
    return null;
  }
  private async withLock<T>(brandId: string, key: string, work: () => Promise<T>): Promise<T> {
    Slug.parse(brandId);
    await this.prepareOutput();
    const locks = path.join(this.outputRoot, '.locks');
    await this.checkedMkdir(locks);
    const lock = path.join(locks, hash([brandId, key]));
    const deadline = Date.now() + 5000;
    for (;;) {
      try { await mkdir(lock); break; }
      catch (error) {
        if (!isExists(error)) throw error;
        if (Date.now() >= deadline) throw new Error('IDEMPOTENCY_IN_PROGRESS: lock timed out; inspect interrupted run before retrying');
        await delay(50);
      }
    }
    try { return await work(); }
    finally { await rm(lock, { recursive: true, force: true }); }
  }
  private async save(raw: BatchArtifacts): Promise<void> {
    const a = BatchArtifactsSchema.parse(raw);
    await this.prepareOutput();
    const destination = path.join(this.outputRoot, a.batch.batch_id);
    const staging = path.join(this.outputRoot, `.staging-${a.batch.batch_id}-${randomUUID()}`);
    await mkdir(staging);
    try {
      const documents: Record<string, unknown> = {
        'batch.json': a.batch, 'brand-context.json': a.brand, 'product-knowledge.json': a.product,
        'strategy.json': a.strategy, 'generation-matrix.json': a.matrix, 'variants.json': a.variants,
        'compliance-decision.json': a.compliance, 'qa-report.json': a.qa, 'cost-report.json': a.cost,
        'efficiency-report.json': a.efficiency, 'execution-summary.json': a.summary,
        'asset-registry.json': a.assets, 'usage-ledger.json': a.usage,
      };
      await mkdir(path.join(staging, 'manifests'));
      const integrity: Record<string, string> = {};
      for (const [filename, data] of Object.entries(documents)) {
        const content = `${JSON.stringify(data, null, 2)}\n`;
        await writeFile(path.join(staging, filename), content, { flag: 'wx' });
        integrity[filename] = contentHash(content);
      }
      for (const manifest of a.manifests) {
        const content = `${JSON.stringify(manifest, null, 2)}\n`;
        await writeFile(path.join(staging, 'manifests', `${manifest.creative_id}.json`), content, { flag: 'wx' });
        integrity[`manifests/${manifest.creative_id}.json`] = contentHash(content);
      }
      await writeFile(path.join(staging, 'integrity.json'), `${JSON.stringify(integrity, null, 2)}\n`, { flag: 'wx' });
      // Whole batch becomes visible in one rename; no partial batch can be returned by idempotency lookup.
      await rename(staging, destination);
    } finally { await rm(staging, { recursive: true, force: true }); }
  }
  async load(batchId: string): Promise<BatchArtifacts> {
    UUID.parse(batchId);
    const directory = `${batchId}/`;
    const integrity = await this.readOutput(directory + 'integrity.json', z.record(Hash));
    if (DOCUMENTS.some(file => !(file in integrity))) throw new Error('Missing artifact integrity record');
    for (const [file, expectedHash] of Object.entries(integrity)) {
      if (!DOCUMENTS.includes(file) && !(file.startsWith('manifests/') && file.endsWith('.json') &&
        UUID.safeParse(file.slice(10, -5)).success)) throw new Error('Unexpected artifact integrity path');
      const target = safePath(this.outputRoot, directory + file);
      const content = await this.readText(path.relative(this.root, target));
      if (contentHash(content) !== expectedHash) throw new Error('Persisted artifact integrity mismatch');
    }
    const read = async (file: string) => this.readOutput(directory + file, z.unknown());
    const batch = await read('batch.json');
    const variants = await read('variants.json');
    const filenames = await readdir(path.join(this.outputRoot, batchId, 'manifests'));
    const manifests = [];
    for (const filename of filenames.sort()) {
      if (!filename.endsWith('.json') || !UUID.safeParse(filename.slice(0, -5)).success) throw new Error('Unexpected manifest filename');
      if (!(`manifests/${filename}` in integrity)) throw new Error('Missing manifest integrity record');
      manifests.push(await read(`manifests/${filename}`));
    }
    const artifacts = BatchArtifactsSchema.parse({ batch, variants, manifests,
      brand: await read('brand-context.json'), product: await read('product-knowledge.json'),
      strategy: await read('strategy.json'), matrix: await read('generation-matrix.json'),
      compliance: await read('compliance-decision.json'), qa: await read('qa-report.json'),
      cost: await read('cost-report.json'), efficiency: await read('efficiency-report.json'),
      summary: await read('execution-summary.json'), assets: await read('asset-registry.json'), usage: await read('usage-ledger.json'),
    });
    if (Object.keys(integrity).length !== DOCUMENTS.length + artifacts.manifests.length ||
      artifacts.batch.batch_id !== batchId || artifacts.batch.request_hash !== hash(artifacts.batch.request) ||
      artifacts.brand.brand_id !== artifacts.batch.request.brand_id || artifacts.product.brand_id !== artifacts.brand.brand_id ||
      artifacts.product.product_id !== artifacts.batch.request.product_id || artifacts.manifests.length !== artifacts.variants.length ||
      artifacts.variants.some(v => v.batch_id !== batchId || v.brand_id !== artifacts.brand.brand_id || v.product_id !== artifacts.product.product_id ||
        !artifacts.manifests.some(m => m.creative_id === v.creative_id))) {
      throw new Error('Persisted batch identity/manifest mismatch');
    }
    artifacts.manifests.sort((a, b) => artifacts.variants.findIndex(v => v.creative_id === a.creative_id) -
      artifacts.variants.findIndex(v => v.creative_id === b.creative_id));
    return artifacts;
  }
}
function isMissing(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'; }
function isExists(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EEXIST'; }
