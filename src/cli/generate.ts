import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { BatchProductionRequestSchema } from '../contracts/schemas.ts';
import { hash } from '../domain/identity.ts';
import { FilesystemRepositories } from '../infrastructure/filesystem.ts';
import { GenerateBatch } from '../application/generate.ts';
import { StructuredLogger } from '../observability/logger.ts';

export function parseRequest(args: string[]) {
  // npm consumes the separator; pnpm can forward it to the script.
  args = args[0] === '--' ? args.slice(1) : args;
  const { values } = parseArgs({ args, strict: true, allowPositionals: false, options: {
    brand: { type: 'string' }, product: { type: 'string' }, angles: { type: 'string', default: '3' },
    hooks: { type: 'string', default: '3' }, visuals: { type: 'string', default: '2' }, budget: { type: 'string', default: '5' },
    currency: { type: 'string', default: 'BRL' }, platform: { type: 'string', default: 'tiktok' },
    tier: { type: 'string', default: 'TEMPLATE' }, 'idempotency-key': { type: 'string' },
    root: { type: 'string', default: process.cwd() }, output: { type: 'string', default: 'outputs' }, help: { type: 'boolean' },
  } });
  if (values.help) return null;
  const number = (value: string | undefined): number => value?.trim() ? Number(value) : NaN;
  const fields = { brand_id: values.brand, product_id: values.product, angles: number(values.angles), hooks_per_angle: number(values.hooks),
    visual_variants: number(values.visuals), budget_limit: number(values.budget), currency: values.currency,
    platform: values.platform, format: 'VIDEO', production_tier_preference: values.tier };
  const request = BatchProductionRequestSchema.parse({ ...fields, idempotency_key: values['idempotency-key'] ?? `cli-${hash(fields)}` });
  return { request, root: path.resolve(values.root!), output: values.output! };
}
export async function main(args: string[]): Promise<number> {
  try {
    const parsed = parseRequest(args);
    if (!parsed) {
      console.log('Marketing OS v0.1: --brand ID --product ID [--angles 1..3 --hooks 1..3 --visuals 1..2 --budget 5 --currency BRL --platform tiktok --idempotency-key KEY --root PATH --output outputs]');
      return 0;
    }
    const adapter = new FilesystemRepositories(parsed.root, parsed.output);
    const result = await new GenerateBatch(adapter.repositories, new StructuredLogger(), adapter.outputRoot).execute(parsed.request);
    console.log('MARKETING OS v0.1');
    console.log(JSON.stringify({ ...result.artifacts.summary, brand_name: result.artifacts.brand.name,
      product_name: result.artifacts.product.name, idempotent_replay: result.reused,
      qa_counts: { pass: result.artifacts.qa.pass, review: result.artifacts.qa.review, fail: result.artifacts.qa.fail },
      production_tiers: { template: result.artifacts.efficiency.template_media, hybrid: result.artifacts.efficiency.hybrid_media,
        premium: result.artifacts.efficiency.premium_media }, budget_limit: result.artifacts.cost.budget_limit,
      currency: result.artifacts.cost.currency, cache_hit_rate: result.artifacts.efficiency.cache_hit_rate ?? 'NOT_AVAILABLE_YET',
      future_media_cost: result.artifacts.cost.future_media_cost,
    }, null, 2));
    return result.artifacts.summary.status === 'READY_FOR_PRODUCTION' ? 0 : 2;
  } catch (error) {
    // CLI flags can contain secrets: do not echo argv or arbitrary parser/schema error payloads.
    const message = error instanceof Error ? error.message : '';
    const known = ['STALE_INPUTS', 'IDEMPOTENCY_CONFLICT', 'IDEMPOTENCY_IN_PROGRESS', 'BUDGET_BLOCKED', 'V0_1_TEMPLATE_ONLY', 'MISSING_TEMPLATE_ASSET'];
    const code = known.find(c => message.startsWith(c)) ?? 'INPUT_OR_EXECUTION_ERROR';
    const hint = code === 'STALE_INPUTS' ? 'Current inputs or compliance changed. Review them before using a new idempotency key.'
      : 'Check flags, fixture files, provenance and repository permissions. No batch was published.';
    console.error(JSON.stringify({ error: code, hint }));
    return code === 'STALE_INPUTS' ? 3 : 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
