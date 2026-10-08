// Variant engine: hook x body x cta x style x voice x music x pacing x captions, each independently swappable.
import {CreativeTemplate, VariantSelection, validateClaims, type SceneT} from '../src/schema.ts';
import {sha256} from './lib.ts';

export function loadTemplate(raw: unknown) {
  const t = CreativeTemplate.parse(raw);
  const problems = validateClaims(t);
  if (problems.length) throw new Error(`claim validation failed:\n${problems.join('\n')}`);
  return t;
}

export function combinationSpace(t: CreativeTemplate) {
  const dims = {
    hook: t.modules.hooks.map((m) => m.module_id),
    body: t.modules.bodies.map((m) => m.module_id),
    cta: t.modules.ctas.map((m) => m.module_id),
    style: t.styles.map((s) => s.style_id),
    voice: t.voices.map((v) => v.voice_id),
    music: t.music.map((m) => m.music_id),
    pacing: ['standard', 'fast'],
    captions: ['karaoke', 'off'],
  };
  const total = Object.values(dims).reduce((n, d) => n * d.length, 1);
  return {dims, total, message_combinations: dims.hook.length * dims.body.length * dims.cta.length};
}

export function variantId(templateHash: string, sel: VariantSelection) {
  const key = [sel.hook, sel.body, sel.cta, sel.style, sel.voice, sel.music, sel.pacing, sel.captions].join('|');
  return `v-${sha256(templateHash + '|' + key).slice(0, 12)}`;
}

export function expand(t: CreativeTemplate, selRaw: unknown) {
  const sel = VariantSelection.parse(selRaw);
  const pick = <T extends {module_id: string}>(list: T[], id: string, dim: string) => {
    const m = list.find((x) => x.module_id === id);
    if (!m) throw new Error(`unknown ${dim} module: ${id}`);
    return m;
  };
  const scenes: SceneT[] = [
    ...pick(t.modules.hooks, sel.hook, 'hook').scenes,
    ...pick(t.modules.bodies, sel.body, 'body').scenes,
    ...pick(t.modules.ctas, sel.cta, 'cta').scenes,
  ];
  const style = t.styles.find((s) => s.style_id === sel.style);
  const voice = t.voices.find((v) => v.voice_id === sel.voice);
  const music = t.music.find((m) => m.music_id === sel.music);
  if (!style || !voice || !music) throw new Error('unknown style/voice/music');
  const claimIds = new Set(scenes.flatMap((s) => s.claim_refs));
  return {sel, scenes, style, voice, music, claims: t.claims.filter((c) => claimIds.has(c.claim_id))};
}
