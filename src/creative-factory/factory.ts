import { CreativeVariantSchema, GenerationMatrixSchema, ProductionManifestSchema, StrategySchema } from '../contracts/schemas.ts';
import type { BatchArtifacts, BatchProductionRequest, BrandContext, CreativeVariant, GenerationMatrix,
  ProductKnowledge, ProductionManifest } from '../contracts/schemas.ts';
import { uuid, hash } from '../domain/identity.ts';
import { facts } from '../domain/product.ts';

export const VERSIONS = { strategy: 'deterministic-1', dna: '1', template: 'faceless-1', prompt: '1', skill: '1' } as const;
export const ZERO_COST = { strategy_cost: 0, copy_cost: 0, image_cost: 0, video_cost: 0,
  tts_cost: 0, render_cost: 0, distribution_cost: 0, total_cost: 0 } as const;
const ANGLES = ['Apresentação documental', 'Informação confirmada', 'Leitura responsável'];
const HOOKS = ['Conheça os dados disponíveis', 'Veja a informação documentada', 'Confira a referência do produto'];
export const DEFAULT_DNA = { dna_id: 'dna-001', version: VERSIONS.dna, hook_type: 'INFORMATIONAL',
  narrative_structure: 'HOOK-FACT-CTA', visual_style: 'FACELESS', pacing: 'STEADY', product_reveal_timing: 'START',
  duration_range: [12, 18], caption_style: 'FACTUAL', audio_style: 'TEXT_ONLY', cta_style: 'INFORMATIONAL' };

export function createStrategy(request: BatchProductionRequest, product: ProductKnowledge, batchId: string, now: string): BatchArtifacts['strategy'] {
  return StrategySchema.parse({
    version: VERSIONS.strategy, mode: 'DETERMINISTIC',
    hypotheses: ANGLES.slice(0, request.angles).map((angle, index) => ({
      hypothesis_id: uuid([batchId, 'hypothesis', index]), brand_id: request.brand_id, product_id: request.product_id,
      objective: 'Planejar apresentação factual sem afirmar resultados não documentados', angle,
      audience_problem: 'UNKNOWN', promise: 'Somente informações documentadas',
      proof_available: product.source_references.map(s => s.source_id), hook_strategy: 'Gancho informativo sem promessa de desempenho',
      format: request.format, platform: request.platform, duration_target: 18, cta_strategy: 'Consultar informações',
      reasoning_summary: `Hipótese experimental ${index + 1}; sem alegação de causalidade ou resultado comercial.`,
      strategy_version: VERSIONS.strategy, created_at: now,
    })),
    dna: DEFAULT_DNA,
  });
}
export function createMatrix(request: BatchProductionRequest, strategy: BatchArtifacts['strategy'], batchId: string): GenerationMatrix {
  return GenerationMatrixSchema.parse({
    batch_id: batchId, template_version: VERSIONS.template, state: 'PLANNED',
    angles: strategy.hypotheses.map((h, i) => ({ angle_id: `angle-${i + 1}`, hypothesis_id: h.hypothesis_id, label: h.angle })),
    hooks: strategy.hypotheses.flatMap((_, a) => HOOKS.slice(0, request.hooks_per_angle)
      .map((text, h) => ({ hook_id: `angle-${a + 1}-hook-${h + 1}`, angle_id: `angle-${a + 1}`, text }))),
    visuals: ['PRODUCT_ONLY', 'KINETIC_TYPOGRAPHY'].slice(0, request.visual_variants)
      .map((execution, i) => ({ visual_variant_id: `visual-${i + 1}`, execution })),
  });
}
export function expandMatrix(matrix: GenerationMatrix, brand: BrandContext, product: ProductKnowledge,
  request: BatchProductionRequest, now: string): { variants: CreativeVariant[]; duplicates_prevented: number } {
  GenerationMatrixSchema.parse(matrix);
  if (matrix.state !== 'PLANNED' || !matrix.angles.length || !matrix.hooks.length || !matrix.visuals.length) throw new Error('Matrix is not expandable');
  for (const rows of [matrix.angles, matrix.hooks, matrix.visuals]) {
    const byId = new Map<string, string>();
    for (const row of rows) {
      const id = 'hook_id' in row ? row.hook_id : 'visual_variant_id' in row ? row.visual_variant_id : row.angle_id;
      const signature = hash(row);
      if (byId.has(id) && byId.get(id) !== signature) throw new Error('Ambiguous matrix decision ID');
      byId.set(id, signature);
    }
  }
  if (matrix.hooks.some(h => !matrix.angles.some(a => a.angle_id === h.angle_id))) throw new Error('Hook references missing angle');
  const seen = new Set<string>();
  const variants: CreativeVariant[] = [];
  let duplicates_prevented = 0;
  for (const angle of matrix.angles) for (const hook of matrix.hooks.filter(h => h.angle_id === angle.angle_id)) for (const visual of matrix.visuals) {
    // Compare semantic content, not only IDs, so aliases cannot evade duplicate prevention.
    const tuple = [angle.label, hook.text, visual.execution, matrix.template_version];
    const key = hash(tuple);
    if (seen.has(key)) { duplicates_prevented++; continue; }
    seen.add(key);
    variants.push(CreativeVariantSchema.parse({
      creative_id: uuid([matrix.batch_id, key]),
      creative_code: `${brand.brand_id.toUpperCase()}-${product.product_id.toUpperCase()}-${brand.default_market}-${request.platform.toUpperCase()}-VID-DNA001-${matrix.batch_id.slice(0, 8).toUpperCase()}-V${String(variants.length + 1).padStart(3, '0')}`,
      brand_id: brand.brand_id, product_id: product.product_id, batch_id: matrix.batch_id,
      market: brand.default_market, locale: brand.default_locale, platform: request.platform, format: request.format,
      angle_id: angle.angle_id, hook_id: hook.hook_id, visual_variant_id: visual.visual_variant_id,
      dna_id: 'dna-001', hypothesis_id: angle.hypothesis_id, production_tier: request.production_tier_preference,
      experiment_id: uuid([matrix.batch_id, 'experiment']), status: 'DRAFT', brand_version: brand.brand_version,
      product_version: product.product_version, strategy_version: VERSIONS.strategy, creative_dna_version: VERSIONS.dna,
      template_version: matrix.template_version, prompt_version: VERSIONS.prompt, estimated_cost: 0,
      actual_cost: null, cost_breakdown: ZERO_COST, created_at: now, updated_at: now,
    }));
  }
  return { variants, duplicates_prevented };
}
export function createManifest(variant: CreativeVariant, matrix: GenerationMatrix, product: ProductKnowledge, assetIds: string[]): ProductionManifest {
  const angle = matrix.angles.find(a => a.angle_id === variant.angle_id);
  const hook = matrix.hooks.find(h => h.hook_id === variant.hook_id);
  const visual = matrix.visuals.find(v => v.visual_variant_id === variant.visual_variant_id);
  if (!angle || !hook || !visual) throw new Error('Creative decisions missing');
  const claim = facts(product)[0];
  if (!claim) throw new Error('No sourced product fact available');
  const cta = 'Consulte as informações documentadas do produto.';
  const label = product.data_label === 'TEST_FIXTURE' ? 'TEST_FIXTURE · NOT_REAL_PRODUCT_DATA' : 'REAL_DATA';
  const text = [label, hook.text, product.name, angle.label, claim.text, cta];
  return ProductionManifestSchema.parse({
    creative_id: variant.creative_id, script: text.join('\n'),
    shot_list: [
      { shot_id: 'shot-1', description: `${visual.execution}: ${hook.text}. Sem rosto identificável.`, duration_seconds: 6, identifiable_face: false },
      { shot_id: 'shot-2', description: `${visual.execution}: ${angle.label}. ${claim.text}. Sem rosto identificável.`, duration_seconds: 8, identifiable_face: false },
      { shot_id: 'shot-3', description: `KINETIC_TYPOGRAPHY: ${cta}`, duration_seconds: 4, identifiable_face: false },
    ],
    image_prompts: [], video_prompts: [], voiceover_text: '', on_screen_text: text, caption: text.join(' · '), cta,
    required_assets: assetIds, faceless_required: true, production_tier: variant.production_tier,
    output_specs: { aspect_ratio: '9:16', resolution: '1080x1920', duration_target: 18, fps: 30,
      subtitle_required: true, audio_required: false }, cost_estimate: ZERO_COST,
    claims: [claim], data_label: product.data_label, data_notice: product.data_notice, template_version: variant.template_version,
  });
}
