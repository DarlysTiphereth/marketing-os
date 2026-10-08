# Análise de custo — Benchmark 001

## 1. Medido nesta rodada (Stack C, laptop Core 5 120U / 7,7 GiB / Intel Graphics)

| Item | Valor | Evidência |
|---|---|---|
| total_cost (API) | **US$ 0,00** | MEASURED — 0 chamadas pagas |
| cost_script | US$ 0 de API; tokens de autoria do agente **UNKNOWN** | template escrito pela sessão Claude Code, não medido |
| cost_images / cost_video_generation | 0 | nenhum modelo generativo usado |
| cost_voice | 0 | OneCore local |
| cost_music | 0 | procedural, seed 1729 |
| cost_render | 0 de nuvem; energia **UNKNOWN** | local |
| compute_time por vídeo | ~170 s (41,8 s de vídeo) / ver tabela de runs | MEASURED (`qc.json → latency_s`) |
| human_minutes durante o run | 0 | OBSERVED |
| tempo de autoria (agente + humano) antes do run | **UNKNOWN** | não cronometrado |

Decomposição do tempo (render do hero, MEASURED): áudio 5,1 s · frames 99,1 s (≈12,7 fps, concorrência 4) · encode x264 `slow` 54,5 s · QC 10,6 s. O encode é ~1/3 do tempo: `-preset medium` deve reduzi-lo ~2–3× (INFERRED, não medido).

## 2. Custo marginal por vídeo projetado (INFERRED, preços DOCUMENTED por terceiros — verificar na contratação)

Preços consultados em 2026-10-07/08 (fontes secundárias; a página oficial de cada provider deve ser revalidada antes de aprovar gasto):

| Componente | Preço de referência | Fonte |
|---|---|---|
| Kling v3 Pro (fal) | US$ 0,112/s sem áudio | devtk.ai, teamday.ai (set/2026) |
| Veo 3.1 Fast (fal) | ~US$ 0,10/s | idem |
| Veo 3.1 Lite (fal) | US$ 0,03/s (720p, sem áudio) | idem |
| Seedance 2.0 (fal) | ~US$ 0,24–0,30/s 720p | idem (direto BytePlus ≈ metade) |
| ElevenLabs TTS | US$ 0,10/1.000 caracteres (Multilingual) · 0,05 (Flash) | puter.com / happyrobot.ai (2026) |
| Shotstack render | US$ 0,20/min PAYG; 5–15,6 ¢/min em planos | lab SOURCE_REGISTRY S005 |
| Remotion licença | grátis ≤ 3 pessoas; senão US$ 25/dev/mês **ou** US$ 0,01/render (mín. US$ 100/mês) | lab S005 (remotion.dev license FAQ) |

### Perfis por vídeo (~40 s, ~600 caracteres de VO)

| Perfil | Composição | API/vídeo |
|---|---|---|
| **C — Remotion-first local** (atual) | 0 IA | **US$ 0** (+ licença Remotion se aplicável: US$ 0,01) |
| **C+voz** | + ElevenLabs Multilingual (600 car.) | ≈ US$ 0,06 |
| **D-lite** | + voz premium + 2 clipes i2v de 5 s (Veo 3.1 Lite) | ≈ 0,06 + 10 × 0,03 = **≈ US$ 0,36** |
| **D-std** | + voz premium + 2 clipes de 5 s (Kling v3 Pro) | ≈ 0,06 + 10 × 0,112 = **≈ US$ 1,18** |
| **Full AI video** (todas as cenas geradas, 40 s) | 40 s Kling v3 Pro + voz | ≈ 4,48 + 0,06 = **≈ US$ 4,54** (sem contar retakes) |
| **Shotstack render** (sem IA) | 0,67 min × 0,20 | ≈ US$ 0,13 + IA à parte |

Retakes: geração de vídeo por IA tipicamente exige >1 tentativa por cena aprovada; a taxa de aproveitamento é **UNKNOWN** até medirmos. Use multiplicador 2–3× como faixa de planejamento (INFERRED).

### Por volume (somente API; LLM de roteiro e compute à parte)

| Perfil | 10 vídeos | 100 vídeos | 1.000 vídeos |
|---|---:|---:|---:|
| C local | US$ 0 | US$ 0 | US$ 0 (Remotion Automators: US$ 10 → mínimo US$ 100/mês) |
| C+voz | 0,60 | 6 | 60 |
| D-lite | 3,60 | 36 | 360 |
| D-std | 11,80 | 118 | 1.180 |
| Full AI | 45,40 | 454 | 4.540 |

**Variantes baratas:** no Variant Engine, assets de IA são gerados por *cena/módulo*, não por variante. Ex.: 3 hooks com clipe de IA + 1 body + 2 CTAs = 6 variantes pagando só 3 clipes de hook (≈ US$ 1,68 em Kling v3 Pro), e as variantes de estilo/voz/pacing/CTA são re-renders locais a US$ 0. Esse é o principal argumento econômico da arquitetura modular. A mesma lógica vale para TTS (cache content-addressed: 8/8 hits no 2º render).

## 3. Custos ainda UNKNOWN
Tokens do LLM por criativo (autoria do template + revisão); energia; custo de VM/Lambda por minuto de render; taxa de retake de IA; tempo humano de aprovação de claims e de criativo.
