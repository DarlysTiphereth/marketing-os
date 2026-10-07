import { CreativeVariantSchema, GenerationMatrixSchema, ProductionManifestSchema, QAReportSchema } from '../contracts/schemas.ts';
import type { AssetRecord, BrandContext, ComplianceDecision, CostReport, CreativeVariant, GenerationMatrix,
  ProductKnowledge, ProductionManifest, QAReport } from '../contracts/schemas.ts';
import { assertSupportedClaim } from '../domain/product.ts';
import { hash } from '../domain/identity.ts';
import { createManifest, VERSIONS } from '../creative-factory/factory.ts';

export interface QAInput { batchId: string; brand: BrandContext; product: ProductKnowledge; variants: CreativeVariant[];
  manifests: ProductionManifest[]; assets: AssetRecord[]; matrix: GenerationMatrix; compliance: ComplianceDecision;
  cost: CostReport; now: string }
export function executeQA(input: QAInput): QAReport {
  const { variants, product, brand } = input;
  const seen = new Set<string>(), ids = new Set<string>(), codes = new Set<string>();
  const globalIssues: string[] = [];
  if (!GenerationMatrixSchema.safeParse(input.matrix).success) globalIssues.push('Invalid matrix schema');
  if (input.compliance.decision === 'ALLOW') {
    const expected = new Set(input.matrix.angles.flatMap(angle => input.matrix.hooks.filter(h => h.angle_id === angle.angle_id)
      .flatMap(hook => input.matrix.visuals.map(visual => hash([angle.label, hook.text, visual.execution, input.matrix.template_version])))));
    if (input.matrix.state !== 'PLANNED' || !expected.size || variants.length !== expected.size) globalIssues.push('Matrix/variant count mismatch');
  }
  if (variants.length !== input.manifests.length) globalIssues.push('Manifest count mismatch');
  if (new Set(input.manifests.map(m => m.creative_id)).size !== input.manifests.length) globalIssues.push('Duplicate manifests');
  if (Math.abs(variants.reduce((s, v) => s + v.estimated_cost, 0) - input.cost.estimated_total) > 1e-9) globalIssues.push('Cost total mismatch');
  const reports: QAReport['reports'] = variants.map(variant => {
    const issues = [...globalIssues];
    let review = false;
    if (!CreativeVariantSchema.safeParse(variant).success) issues.push('Invalid creative schema');
    const key = hash([variant.angle_id, variant.hook_id, variant.visual_variant_id, variant.template_version]);
    if (seen.has(key) || ids.has(variant.creative_id) || codes.has(variant.creative_code)) issues.push('Duplicate variant');
    seen.add(key); ids.add(variant.creative_id); codes.add(variant.creative_code);
    if (variant.brand_id !== brand.brand_id || variant.product_id !== product.product_id || product.brand_id !== brand.brand_id ||
      variant.batch_id !== input.batchId || variant.market !== brand.default_market || variant.locale !== brand.default_locale ||
      variant.platform !== input.compliance.platform || variant.format !== input.compliance.content_type) issues.push('Brand/product/batch/output isolation mismatch');
    if (variant.brand_version !== brand.brand_version || variant.product_version !== product.product_version ||
      variant.strategy_version !== VERSIONS.strategy || variant.creative_dna_version !== VERSIONS.dna ||
      variant.template_version !== input.matrix.template_version || variant.prompt_version !== VERSIONS.prompt ||
      !input.matrix.angles.some(a => a.angle_id === variant.angle_id && a.hypothesis_id === variant.hypothesis_id) ||
      variant.dna_id !== 'dna-001') issues.push('Decision/version mismatch');
    if (variant.status !== 'QA_REVIEW') issues.push('Creative must enter QA_REVIEW before QA');
    if (input.cost.budget_status === 'BUDGET_BLOCKED' || input.cost.estimated_total > input.cost.budget_limit) issues.push('Budget blocked');
    if (input.compliance.decision === 'BLOCK') issues.push('Compliance blocked');
    if (input.compliance.decision === 'REVIEW') review = true;
    if (product.knowledge_status === 'INCOMPLETE' || product.missing_information.length) review = true;
    const manifest = input.manifests.find(m => m.creative_id === variant.creative_id);
    if (!manifest) issues.push('Missing manifest');
    else {
      if (!ProductionManifestSchema.safeParse(manifest).success) issues.push('Invalid manifest/faceless/output schema');
      for (const claim of manifest.claims) {
        try { assertSupportedClaim(claim, product); } catch { issues.push('Unsupported or unsourced product claim'); }
      }
      if (!manifest.claims.length) issues.push('Missing product provenance');
      const assets = manifest.required_assets.map(id => input.assets.find(a => a.asset_id === id &&
        a.brand_id === brand.brand_id && a.product_id === product.product_id && a.faceless_verified && a.data_label === product.data_label));
      if (!assets.length || assets.some(a => !a) || manifest.required_assets.some(id => !product.assets.includes(id))) issues.push('Missing or invalid reusable assets');
      if (manifest.template_version !== variant.template_version || manifest.production_tier !== variant.production_tier) issues.push('Manifest version/tier mismatch');
      if (Math.abs(manifest.shot_list.reduce((s, shot) => s + shot.duration_seconds, 0) - manifest.output_specs.duration_target) > 1e-9) issues.push('Shot duration mismatch');
      const text = [manifest.script, manifest.caption, manifest.cta, manifest.voiceover_text, ...manifest.on_screen_text,
        ...manifest.image_prompts, ...manifest.video_prompts, ...manifest.shot_list.map(s => s.description)].join(' ').toLocaleLowerCase();
      if (text.includes('real_data')) issues.push('Internal data label leaked into media text');
      if (product.data_label !== 'TEST_FIXTURE' && (text.includes('test_fixture') || text.includes('not_real_product_data'))) {
        issues.push('Fixture placeholder leaked into non-fixture media text');
      }
      if ([...brand.prohibited_patterns, ...product.prohibited_claims].some(p => text.includes(p.toLocaleLowerCase()))) issues.push('Prohibited brand/product pattern');
      try {
        const expected = createManifest(variant, input.matrix, product, manifest.required_assets);
        if (hash(manifest) !== hash(expected)) issues.push('Unverified content or modified deterministic template');
      } catch { issues.push('Invalid manifest decision references'); }
      if (manifest.data_label !== product.data_label || manifest.data_notice !== product.data_notice) issues.push('Fixture/data labeling mismatch');
    }
    return { creative_id: variant.creative_id, status: issues.length ? 'FAIL' : review ? 'REVIEW' : 'PASS', issues };
  });
  const pass = reports.filter(r => r.status === 'PASS').length;
  const review = reports.filter(r => r.status === 'REVIEW').length;
  const fail = reports.filter(r => r.status === 'FAIL').length;
  const status = fail || globalIssues.length || input.compliance.decision === 'BLOCK' ? 'FAIL'
    : review || input.compliance.decision === 'REVIEW' ? 'REVIEW' : 'PASS';
  return QAReportSchema.parse({ batch_id: input.batchId, checked_at: input.now, status, reports, pass, review, fail });
}
