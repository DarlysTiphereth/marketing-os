# Auditoria de recursos locais e benchmark A (local) × B (remoto gratuito)

Data: 2026-10-08 · Máquina: Windows 11, Core 5 120U (12 threads), 7,7 GiB RAM, Intel Graphics (sem GPU NVIDIA).

## 1. O que consome recursos hoje (MEASURED, `du` / medidor)

| Item | Local | Tamanho | Necessário localmente? | Para onde pode ir |
|---|---|---:|---|---|
| Render de vídeo (Chrome + FFmpeg) | Marketing OS | ver benchmark | não | GitHub Actions (público, fixture) · Colab manual · local opt-in |
| Render estático (Chrome) | Marketing OS | ~5 cpu·s/16 peças | leve | pode ficar local; remoto quando houver executor |
| `experiments/remotion/node_modules` | Marketing OS | 540 MB | só se renderizar local | runners instalam sob demanda |
| `experiments/remotion/runs` (MP4/WAV) | Marketing OS | 216 MB | não | CAS com retenção; MP4 nunca no Git |
| Chrome baixado por engano (`node_modules/.remotion`) | Marketing OS | 283 MB | não | **remoção pendente de aprovação** |
| `%TEMP%/remotion-webpack-bundle-*` (11 pastas) | Windows | 307 MB | não | quarentena após TTL, com aprovação |
| `%TEMP%/puppeteer_dev_chrome_profile-*` | Windows | ~2–3 MB/run | não | idem (agora na allowlist) |
| Lab: `.tools` (FFmpeg 311 MB, pnpm store 218 MB, bundles 56 MB) | media-stack-lab | 583 MB | FFmpeg/Chrome usados como runtime | manter até haver executor remoto estável |
| Lab: OpenMontage (`.venv` 172 MB + checkout/caches 652 MB) | media-stack-lab | 826 MB | não para o fluxo atual | pode ser recriado em Colab/CI quando necessário |
| Lab: `experiments/remotion/node_modules` | media-stack-lab | 645 MB | só o Chrome headless (reutilizado) | manter Chrome; resto opcional |

Nada foi removido. O lab pertence a outro perfil de execução e permanece intocado.

### Vazamentos e problemas encontrados e corrigidos no caminho
1. `bundle()` do Remotion gravava um bundle novo de ~29 MB em `%TEMP%` a cada render → agora cacheado em `.mos/cache/bundles/<fingerprint do src>`.
2. `renderFrames` reabre um browser com o próprio parâmetro `browserExecutable` após uma falha de página → baixou 281,6 MB de Chrome silenciosamente. Corrigido passando o executável em todas as chamadas.
3. Processo de render ficava vivo após erro (Chrome aberto) → em worker remoto queimaria minutos até o timeout. Corrigido com saída forçada após gravar manifests.
4. MP4 não reproduzível byte a byte (metadados) → dedup do CAS não funcionava. Corrigido com `-fflags +bitexact`.
5. CI rodava 4 jobs (Windows/macOS/Ubuntu×2) em todo push → agora 1 job em push e matriz completa só em PR (OBSERVED: push da branch gerou 1 job).

## 2. Benchmark

Mesmo job nos dois fluxos: fixture TEST_FIXTURE de 34,2 s (8 cenas, sem voz), 1080×1920, 30 fps, H.264/AAC.

### A — fluxo local (MEASURED, 3 rodadas, amostragem da árvore de processos a cada 1,5 s)

| Rodada | Tempo | RAM pico (soma da árvore) | CPU | CPU média da máquina | GPU | Disco `.mos` | `%TEMP%` | Download Chrome |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 (com bundle) | 156,2 s | 1,25 GB | 672,5 cpu·s | 35,9% | 0% | +42 MB | n/d* | 0 |
| 2 (bundle em cache) | 159,0 s | 1,23 GB | 745,4 cpu·s | 39,1% | 0% | +42 MB | +1,8 MB | 0 |
| 3 (bundle em cache) | 157,3 s | 1,12 GB | 723,7 cpu·s | 38,4% | 0% | +16 MB | +1,8 MB | 0 |

\* a rodada 1 incluiu a pasta temporária da própria sessão Claude Code (316 MB) na medição; a partir da 2 essa pasta é excluída (`MOS_MEASURE_EXCLUDE`).
Artefato: MP4 ~21 MB; QC técnico PASS nas rodadas 2 e 3 (rodada 1 reprovou com true peak −0,6 dBTP; corrigido).
Observação: o medidor soma bytes de hardlinks duas vezes (CAS + pasta do run); fisicamente o MP4 existe uma vez.

### B — fluxo remoto gratuito (MEASURED no lado local; remoto NOT_RUN)

| Métrica local | Valor |
|---|---:|
| Tempo do control plane (enqueue + dispatch) | 0,7 s (+1,8 s com o medidor) |
| RAM pico | 91 MB (`process.resourceUsage().maxRSS`) |
| CPU | 0,31 cpu·s |
| GPU | 0 |
| Disco local | 492 bytes (estado da fila) |
| Custo | US$ 0 |
| Resultado do job | `QUEUED` — "GitHub account is billing-locked: Actions jobs are not started" |

**Não alegado:** tempo total remoto, tamanho do artefato remoto, qualidade do vídeo remoto e consumo do runner — o runner não iniciou. A diferença local A→B (−92% de RAM, −99,9% de CPU) só se realiza quando houver executor remoto disponível; até lá o job aguarda na fila.

## 3. OpenMontage em execução remota gratuita (Etapa 6)
- Integra providers por API (Kling, Veo, Seedance, Wan, LTX, Runway…) — todos **pagos** → fora do escopo zero-cost.
- Partes gratuitas: pipelines de direção/roteiro (executadas pelo agente), HyperFrames (Chrome/GSAP, CPU), Piper TTS, busca em Pexels/Pixabay (chave gratuita). Podem rodar num runner Linux ou em Colab **sem GPU**.
- Licença AGPLv3: rodar num runner de repositório público é compatível; não misturar com código distribuído do Marketing OS.
- Remotion e FFmpeg continuam desacoplados: o OpenMontage, se usado, produz plano/assets e entrega um `creative.json`; o render passa pelo mesmo `RenderWorker`.
- Wan/LTX locais exigem GPU NVIDIA → não aplicável aqui; Colab GPU só em uso interativo pontual, nunca como infraestrutura.
