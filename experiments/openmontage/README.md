# Stack A — OpenMontage puro

**Status nesta rodada: NOT_RUN para o conceito DR de 40 s. Evidência anterior disponível (OBSERVED, não controlada).**

## Evidência existente (media-stack-lab, Benchmark 002, 2026-10-07)
- OpenMontage commit `9327439d…` (AGPLv3), pipeline `animation` → HyperFrames 0.8.140 + GSAP + Chrome headless + FFmpeg.
- 2 renders de 15 s, 1080×1920, 30 fps, H.264+AAC, binariamente idênticos; CLI render 79,4 s / 71,0 s; 0 APIs pagas.
- Nota editorial do agente da época: 40/50. Limites: voz SAPI básica, macro de packshot 800 px suave, `check strict=false`, motion checker desligado, 2 patches locais (schema enum + settings).
- Registry de providers: 0/23 imagegen, 0/31 videogen, 0/13 TTS configurados (sem chaves) — i.e. **o “teto” do OpenMontage sem chaves é o mesmo teto do HTML/GSAP autoral do agente**.
- Relatório completo: `C:\Projects\media-stack-lab\results\BENCHMARK_002_OPENMONTAGE.md`.

## Por que não rodou agora
1. O lab pertence a outro perfil de execução (git `dubious ownership`, owner `CodexSandboxOffline`); não foi modificado para preservar o histórico.
2. Reproduzir o conceito de 40 s exige o agente reescrever 8 cenas em HTML/GSAP dentro do pipeline OM (≈ trabalho de autoria igual ao Stack C) — feito antes de comparar a arquitetura, seria duplicar esforço sem informação nova.

## Para rodar (próximo passo, sem custo de API)
1. Copiar/clonar OM pinado para `experiments/openmontage/upstream/` (AGPL: manter fora do código distribuído do Marketing OS).
2. Escrever adapter `timeline.json (creative.v1) → OM scene_plan/edit_decisions` (o contrato já contém tempos/beats/claims).
3. Renderizar com HyperFrames; rodar o **mesmo** `pipeline/qc.ts` sobre o MP4.
