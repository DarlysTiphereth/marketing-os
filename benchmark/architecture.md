# Arquitetura — Content Factory do Marketing OS

> Status: **proposta (INFERRED)** apoiada por um slice executado (Stack C, MEASURED). Nada aqui altera o núcleo v0.1 (`src/`), que continua sem mídia/IA real por contrato (AGENTS.md). A camada de mídia vive em `experiments/` até ser promovida.

## 1. Camadas

```
MARKETING OS (existente, v0.1 — planejamento determinístico, 63 testes)
 BRAND LAYER ─ PRODUCT LAYER (provenance, claims com source_ids) ─ COMPLIANCE (SafeZone REVIEW default)
        │
 CREATIVE INTELLIGENCE ── Reference DNA (§4) · ângulos · awareness · objeções
        │
 CONTENT STRATEGY ─ matriz de geração (já existe: 18 variantes/batch) ─ budgets/cost controls (já existe)
        │                                     ▼  adapter ProductionManifest → creative.v1   ◄── NOVO (seam)
 SCRIPT ENGINE ─ STORYBOARD ENGINE  ──►  creative.v1 (modular: hooks[] · bodies[] · ctas[] · styles · voices · music)
        │
 VARIANT ENGINE  (expand: hook×body×cta×style×voice×music×pacing×captions → variant_id determinístico)
        │
 ASSET ROUTER  (por cena, visual_type → fonte mais barata que atende à qualidade)
   ├─ local_brand_asset (packshot/rótulo/crops lossless)        $0      ✅ usado
   ├─ procedural (motion graphics/ilustração Remotion)          $0      ✅ usado
   ├─ stock (Pexels/Pixabay/Storyblocks — licença por clipe)    $0–$    NOT_TESTED
   ├─ ai_image (gen/edit)                                       $       NOT_TESTED
   ├─ ai_video / image-to-video (Kling, Veo, Seedance…)         $$–$$$  NOT_TESTED
   └─ archive footage (domínio público, faceless)               $0      NOT_TESTED
        │
 VOICE ─ local OneCore ($0, 16 kHz — limitante) | premium TTS (ElevenLabs etc., aprovação)   [cache content-addressed]
 MUSIC/SFX ─ procedural seeded ($0) | biblioteca licenciada | gerador (aprovação)
        │
 COMPOSITOR/RENDERER (port `RendererPort.render(timeline) → mp4`)
   ├─ Remotion renderFrames + FFmpeg externo  ✅ (Stack C, MEASURED)
   ├─ OpenMontage → HyperFrames               (Benchmark 002 do lab, OBSERVED, 15 s)
   └─ Shotstack (cloud)                       NOT_TESTED (sem conta/chave)
        │
 QUALITY CONTROL ─ técnico (bloqueante, MEASURED) · visual (contact sheet) · criativo (rubrica 0–10, ≤2 ciclos)
        │
 PUBLISHING PACKAGE (mp4 + manifest/creative/assets/cost/qc/run.log + metadata) — publicação: NÃO nesta fase
        │
 EXPERIMENT ENGINE ─► PERFORMANCE DATA (§5) ─► LEARNING LOOP (pesos por hook_id/angle_id/style… → Strategy)
```

### Princípio de divisão de responsabilidade (hipótese principal confirmada no slice)
- **Agente/LLM decide** (ângulo, copy, storyboard, escolha de módulo) e produz **JSON validado**.
- **Código controla** IDs, expansão de variantes, timing (derivado da fala medida), claims, budgets, QC e manifests.
- **IA generativa de mídia é *asset generator* por cena**, nunca o editor do vídeo inteiro. O renderer programático garante tipografia, CTA, legendas, safe zones e determinismo.

## 2. Contrato `creative.v1`
Fonte de verdade: [`experiments/remotion/src/schema.ts`](../experiments/remotion/src/schema.ts) (zod, mesmo idioma do núcleo). Campos do §7 do pedido: `creative_id, objective, audience, platforms, awareness_level, angle, promise, problem, mechanism, proof, benefits, objections, claims[], scenes[]` com `scene_id, duration (min_duration_s → resolvida), purpose, voiceover, on_screen_text, visual_type, visual_prompt, camera, motion, transition, music_direction, sfx, asset_source, generation_model, estimated_cost_usd, claim_refs, layout`.

Decisões:
- `claims[]` com `source_type/source_ref/approval`; `validateClaims()` falha o build se uma cena referenciar claim inexistente. `proof.status = NONE_AVAILABLE` é um estado válido e explícito.
- `layout.component` é dica opcional por renderer; renderers que não a conhecem caem para `visual_type`.
- A **Timeline** (creative + tempos medidos + beats alinhados à fala) é o objeto entregue ao renderer — é o que torna o mesmo criativo portável para Remotion, HyperFrames ou Shotstack.

## 3. Variant Engine
Implementado em [`pipeline/variants.ts`](../experiments/remotion/pipeline/variants.ts). Dimensões independentes: HOOK, BODY (script/estrutura), CTA, VISUAL STYLE, VOICE, MUSIC, PACING, CAPTIONS. Headline/first frame/B-roll são propriedades dos módulos de hook/cena.
- Template atual: 3 hooks × 2 bodies × 2 CTAs = **12 combinações de mensagem**; × 2 estilos × 2 vozes × 1 música × 2 pacings × 2 legendas = **192 variantes possíveis**. Renderizadas: amostra de 4 (ver scorecard).
- `variant_id = sha256(template_hash | seleção)` → idempotente; re-render da mesma seleção gera o mesmo ID.
- Cache content-addressed de TTS: falas iguais entre variantes são sintetizadas uma vez (observado: 8/8 cache hits no 2º render).
- Anti-spam/dedup (para escala): rejeitar variantes cuja distância (hook, body, style, voice) para variantes já publicadas no mesmo canal seja < limiar; limite de variantes por conta/dia.

## 4. Reference-based Creative Intelligence (projeto)
Entrada: vídeo de referência fornecido pelo usuário. Saída: `reference_dna.json` — **estrutura, nunca conteúdo**:
```json
{"duration_s":0,"hook":{"type":"question|bold_claim|pattern_interrupt|curiosity","first_frame":"descrição","time_to_first_word_s":0},
 "cuts_per_10s":0,"avg_shot_s":0,"structure":["hook","problem","demo","proof","cta"],"text_density_words_per_s":0,
 "caption_position":"lower_third","camera":["macro","handheld"],"broll_ratio":0,"music":{"bpm":0,"energy_curve":[]},
 "sfx_density_per_10s":0,"proof_type":"demo|testimonial|stat|none","cta":{"type":"","time_s":0},"emotional_rhythm":[]}
```
Medições automáticas possíveis localmente: `ffmpeg scdet` (cortes), `ebur128` (energia), OCR de frames (densidade de texto), ASR (tempo até 1ª palavra). O DNA alimenta o storyboard; um teste de similaridade (frames/copy) bloqueia saídas próximas demais da referência. **NOT_TESTED** — nenhum vídeo de referência foi fornecido.

## 5. Performance loop (interface, não implementado)
Schema: [`schema/performance-metrics.schema.json`](schema/performance-metrics.schema.json). Ingestão por `variant_id` + `platform` + janela; correlação com `hook_id, body_id, cta_id, angle_id, visual_style, voice, duration, pacing, captions`. Métricas: impressions, 3_sec_views, watch_time, completion_rate, CTR, CPC, CPM, CPA, CVR, ROAS, revenue. Aprendizado sugerido: modelo hierárquico/bandit por dimensão com mínimo de impressões antes de decidir; nunca reescrever claims a partir de métricas.

## 6. Faceless Content Engine (Sistema B — projeto)
```
topic discovery (trends/keywords/backlog) → scoring (interesse × evergreen × risco × originalidade)
→ research (fontes primárias) → source validation (≥2 fontes, datas, citação por claim) → story/angle
→ hooks (N) → script (claims → source_ids) → storyboard (creative.v1, slot narrativo) → asset routing
(arquivo público/stock/AI image/procedural) → voice → editing (Remotion) → captions → QC (técnico+factual)
→ thumbnail/title/caption → content package (+ fontes citadas)
```
Guard-rails: claims factuais exigem `source_ids` (mesmo contrato do produto); similaridade de roteiro contra produção própria e contra referências (anti-quase-duplicado); footage só com licença registrada no `assets.json`; limite de publicações por canal. Teste B (30–60 s, 2 aberturas × 2 estruturas × 2 estilos) **NOT_RUN** nesta rodada — exige tópico e pesquisa com fontes; ver próximos passos.

## 7. Onde isso entra no código (promoção)
1. `src/contracts/ports.ts`: adicionar `RendererPort`, `VoicePort`, `AssetRouterPort` (interfaces apenas; v0.1 mantém implementações fake).
2. Adapter `ProductionManifest → creative.v1` em `src/creative-factory/` (puro, testável).
3. Implementações reais (Remotion/TTS/FFmpeg) em um pacote `media/` separado, fora do build v0.1, ligadas por config — preserva os 63 testes e a regra "v0.1 sem mídia".
