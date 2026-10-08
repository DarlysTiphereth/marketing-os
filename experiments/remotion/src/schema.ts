// creative.v1 — renderer-agnostic creative contract (Benchmark 001).
// Shared by the Node pipeline and the Remotion bundle. Any renderer (Remotion, OpenMontage/HyperFrames,
// Shotstack) must be able to consume a resolved CreativeSpec without reading this codebase.
import {z} from 'zod';

const Id = z.string().regex(/^[a-z0-9][a-z0-9_-]{1,63}$/);

export const EvidenceStatus = z.enum(['DOCUMENTED', 'OBSERVED', 'MEASURED', 'INFERRED', 'NOT_TESTED', 'UNKNOWN']);

// No source -> no claim. Every on-screen/voiceover assertion about the product must reference one of these.
export const Claim = z.object({
  claim_id: Id,
  text: z.string().min(1),
  source_type: z.enum(['PRODUCT_LABEL', 'PRODUCT_PACKSHOT', 'CATALOG', 'USER_APPROVED_COPY']),
  source_ref: z.string().min(1),
  approval: z.enum(['USER_APPROVED', 'SOURCED_PENDING_APPROVAL']),
});

export const VisualType = z.enum([
  'kinetic_type', 'product_hero', 'label_macro', 'illustration', 'motion_graphic',
  'step_cards', 'benefit_stack', 'cta_card', 'stock_footage', 'ai_video', 'ai_image', 'product_photo',
]);

export const AssetSource = z.enum(['local_brand_asset', 'procedural', 'stock', 'ai_generated', 'archive']);

export const Scene = z.object({
  scene_id: Id,
  slot: z.enum(['hook', 'problem', 'tension', 'demo', 'benefits', 'proof', 'payoff', 'cta']),
  min_duration_s: z.number().positive().max(20),
  purpose: z.string().min(1),
  voiceover: z.string(),
  on_screen_text: z.array(z.string()).max(6),
  visual_type: VisualType,
  visual_prompt: z.string(),
  camera: z.string(),
  motion: z.string(),
  transition: z.enum(['cut', 'flash', 'whip', 'zoom_punch', 'wipe', 'none']),
  music_direction: z.string(),
  sfx: z.array(z.string()),
  asset_source: AssetSource,
  generation_model: z.string(),
  estimated_cost_usd: z.number().min(0),
  claim_refs: z.array(Id),
  // Renderer-specific layout hint; renderers that do not know the key must fall back to visual_type.
  layout: z.object({component: z.string(), params: z.record(z.unknown()).default({})}),
  disclaimer: z.string().optional(),
});

export const Module = z.object({module_id: Id, label: z.string(), scenes: z.array(Scene).min(1)});

export const VisualStyle = z.object({
  style_id: Id,
  palette: z.object({bg0: z.string(), bg1: z.string(), accent: z.string(), ink: z.string(), paper: z.string(), danger: z.string()}),
  font_display: z.string(),
  font_body: z.string(),
  palette_status: z.enum(['DERIVED_FROM_APPROVED_ASSET', 'OFFICIAL_BRAND', 'DESIGN_CHOICE', 'TEST_FIXTURE']),
});

export const Voice = z.object({voice_id: Id, provider: z.string(), voice_name: z.string(), rate_pct: z.number().min(-30).max(40)});
export const Music = z.object({music_id: Id, provider: z.string(), bpm: z.number().min(70).max(160), mood: z.string(), seed: z.number().int()});

export const CreativeTemplate = z.object({
  schema_version: z.literal('creative.v1'),
  creative_id: Id,
  brand_id: Id,
  product_id: Id,
  objective: z.string(),
  audience: z.string(),
  platforms: z.array(z.string()).min(1),
  awareness_level: z.enum(['unaware', 'problem_aware', 'solution_aware', 'product_aware', 'most_aware']),
  angle: z.object({angle_id: Id, text: z.string()}),
  promise: z.string(),
  problem: z.string(),
  mechanism: z.string(),
  proof: z.object({status: z.enum(['AVAILABLE', 'NONE_AVAILABLE']), items: z.array(z.string()), note: z.string()}),
  benefits: z.array(z.string()),
  objections: z.array(z.object({objection: z.string(), answer: z.string(), claim_refs: z.array(Id)})),
  claims: z.array(Claim),
  format: z.object({width: z.literal(1080), height: z.literal(1920), fps: z.literal(30)}),
  assets: z.record(z.object({path: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/), kind: z.string(), status: z.string()})),
  modules: z.object({hooks: z.array(Module).min(1), bodies: z.array(Module).min(1), ctas: z.array(Module).min(1)}),
  styles: z.array(VisualStyle).min(1),
  voices: z.array(Voice).min(1),
  music: z.array(Music).min(1),
  // Brand text shown by the renderer. Lives in data, never hardcoded in components.
  display: z.object({brand_name: z.string().min(1), brand_tagline: z.string(), product_title: z.string().min(1), product_subtitle: z.string()}),
});

// One concrete combination. Every dimension is independently swappable (section 8).
export const VariantSelection = z.object({
  hook: Id, body: Id, cta: Id, style: Id, voice: Id, music: Id,
  pacing: z.enum(['standard', 'fast']),
  captions: z.enum(['karaoke', 'off']),
});

export type CreativeTemplate = z.infer<typeof CreativeTemplate>;
export type SceneT = z.infer<typeof Scene>;
export type VariantSelection = z.infer<typeof VariantSelection>;
export type VisualStyleT = z.infer<typeof VisualStyle>;

// Timeline = the resolved, renderer-ready object (creative + timing). This is what Remotion receives as props.
export type TimedWord = {text: string; start: number; end: number};
export type TimedScene = SceneT & {start: number; duration: number; vo_start: number; vo_duration: number; words: TimedWord[]; beats: number[]};
export type Timeline = {
  variant_id: string;
  creative_id: string;
  selection: VariantSelection;
  style: VisualStyleT;
  fps: number;
  width: number;
  height: number;
  duration: number;
  scenes: TimedScene[];
  assets: Record<string, string>; // logical name -> file name served from public dir
  display: {brand_name: string; brand_tagline: string; product_title: string; product_subtitle: string};
};

export function validateClaims(t: CreativeTemplate): string[] {
  const ids = new Set(t.claims.map((c) => c.claim_id));
  const problems: string[] = [];
  const all = [...t.modules.hooks, ...t.modules.bodies, ...t.modules.ctas].flatMap((m) => m.scenes);
  for (const s of all) for (const ref of s.claim_refs) if (!ids.has(ref)) problems.push(`${s.scene_id}: unknown claim ${ref}`);
  for (const o of t.objections) for (const ref of o.claim_refs) if (!ids.has(ref)) problems.push(`objection: unknown claim ${ref}`);
  return problems;
}
