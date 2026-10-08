# Stack C — Remotion-first (também o núcleo do Stack D)

`creative.v1` → variant engine → TTS local (cache) → timeline (duração = fala medida) → música/SFX procedurais + ducking + loudnorm → **Remotion `renderFrames`** (Chrome headless) → **FFmpeg externo** (x264/AAC) → QC técnico → manifests.

Experimento isolado: **não faz parte do build/testes do núcleo v0.1** (`tsconfig` inclui só `src/` e `tests/`).

## Por que renderFrames + FFmpeg externo
Nesta máquina o Windows Application Control bloqueia o compositor/FFmpeg empacotado do Remotion (NotSigned — observado no media-stack-lab, Benchmark 001). `renderFrames` não usa esse binário; o encode vai para o FFmpeg 9.0.2 portátil, que executa. Isso também elimina o problema de timing do web-renderer (Benchmark 001B: 14,967 s em vez de 15 s): aqui, `frames decodificados == frames da timeline` é um gate.

## Rodar
Runtimes usados (não estão no PATH do sistema): Node 24.19 / pnpm 11.25 do runtime Codex em `%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\`, FFmpeg/Chrome headless do media-stack-lab. Sobrescreva com `MOS_FFMPEG`, `MOS_FFPROBE`, `MOS_CHROME`.

```bash
pnpm install --prefer-offline
node pipeline/preview.ts --hook hook-a --body body-1 --cta cta-a            # stills por beat, ~1 min
node pipeline/produce.ts --hook hook-a --body body-1 --cta cta-a --pacing fast
node pipeline/produce.ts --hook hook-c --body body-2 --cta cta-a --style clean-bright --voice daniel --pacing fast
```

Assets da marca (`public/*.png`) são privados e ignorados pelo Git; hashes estão no creative e são verificados antes de cada run (falha = run abortado).

## Saída por run — `runs/<timestamp>_<variant_id>/`
`manifest.json` (ferramentas, versões, seeds, parâmetros, commit, falhas) · `creative.json` (variante resolvida + claims usados) · `timeline.json` · `assets.json` (hashes, falas TTS, cues de SFX, licença da música) · `cost.json` · `qc.json` (gates, métricas, latências) · `run.log` (JSONL) · `contact-sheet.jpg` · `final.mp4` e `mix.wav` (ignorados pelo Git).

## Arquivos
| Arquivo | Papel |
|---|---|
| `src/schema.ts` | contrato `creative.v1` + Timeline (zod) |
| `src/Ad.tsx` | composição: backdrop, transições, kinetic type, produto real (sem redesenho), 10 cenas, legendas karaokê |
| `creatives/grand-sabao-5l.creative.json` | template modular GRAND (3 hooks, 2 bodies, 2 CTAs, 2 estilos, 2 vozes) com claims rastreados |
| `pipeline/variants.ts` | expansão/IDs/espaço combinatório |
| `pipeline/voice.ts`, `pipeline/tts/onecore-tts.ps1` | TTS OneCore offline com timestamps por palavra + cache |
| `pipeline/timeline.ts` | tempos por fala medida; beats de texto alinhados à palavra falada |
| `pipeline/audio.ts` | música procedural (seed), biblioteca de SFX, ducking, loudnorm 2-pass, limiter |
| `pipeline/render.ts`, `pipeline/qc.ts`, `pipeline/produce.ts`, `pipeline/preview.ts` | render, QC, orquestração, preview |

## Limitações conhecidas (honestas)
- Voz OneCore sai em **16 kHz mono** (MEASURED) — teto de qualidade/credibilidade; principal motivo de não aprovação criativa.
- Ilustrações do problema (camiseta/manchas) são vetoriais — legíveis, porém "clip-art"; sem filmagem real.
- Música/SFX procedurais: licença limpa, qualidade estética **não validada por escuta humana**.
- Sem ASR: inteligibilidade/pronúncia da voz UNKNOWN. Sem playback contínuo humano.
- Remotion: licença gratuita só para empresas ≤ 3 pessoas (DOCUMENTED, lab S005); telemetria/licensing de `renderFrames` nesta versão não foi auditada (UNKNOWN).
