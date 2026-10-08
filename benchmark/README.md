# Benchmark 001 — Content Factory (Marketing OS)

**Resultado em uma linha:** pipeline Remotion-first funcionando de ponta a ponta (creative.json → variantes → voz → música/SFX → render → QC → manifests), 7 renders medidos a **US$ 0 de API**; o melhor criativo chega a **7,0/10 (não aprovado, < 8)** — o gargalo é credibilidade (voz sintética 16 kHz, nenhuma prova real disponível, problema ilustrado), não a arquitetura. Decisão provisória: **OpenMontage = KEEP_AS_OPTIONAL; arquitetura HYBRID com núcleo Remotion-first**.

| Documento | Conteúdo |
|---|---|
| [methodology.md](methodology.md) | rótulos de evidência, gates técnicos/visuais/criativos, controles |
| [architecture.md](architecture.md) | Content Factory, creative.v1, variant engine, Reference DNA, faceless engine, performance loop |
| [scorecard.md](scorecard.md) | tabela do §24, runs, creative QC por ciclo |
| [cost-analysis.md](cost-analysis.md) | custos medidos + projeção por perfil e volume |
| [scale-analysis.md](scale-analysis.md) | 10 → 1.000 vídeos/dia (modelagem) |
| [final-recommendation.md](final-recommendation.md) | decisão, justificativa, próximos passos e aprovações pendentes |
| [schema/performance-metrics.schema.json](schema/performance-metrics.schema.json) | interface do learning loop (futuro) |

Experimentos: [`experiments/remotion`](../experiments/remotion/README.md) (executado) · [`experiments/openmontage`](../experiments/openmontage/README.md) · [`experiments/openmontage-remotion`](../experiments/openmontage-remotion/README.md) · [`experiments/hybrid`](../experiments/hybrid/README.md).

## Auditoria do ambiente (2026-10-07, OBSERVED)

| Item | Resultado |
|---|---|
| Máquina | Windows 11 Home 26200 · Intel Core 5 120U (12 threads) · 7,7 GiB RAM · Intel Graphics (VRAM dedicada UNKNOWN) · ~100 GB livres |
| Node / pnpm / Python | **não estão no PATH**; Node 24.19, pnpm 11.25, Python 3.12.14 do runtime Codex (`~/.cache/codex-runtimes/...`) |
| FFmpeg / FFprobe | 9.0.2 portátil em `C:\Projects\media-stack-lab\.tools` (SHA verificado pelo lab) |
| Chrome headless | Chrome Headless Shell do lab (Remotion) |
| Remotion | 4.0.534 instalado em `experiments/remotion` (pnpm, 185 pacotes reutilizados do store do lab, 1 baixado) |
| Bloqueio conhecido | Windows Application Control bloqueia o compositor/FFmpeg empacotado do Remotion (lab B001). **Contornado sem alterar segurança:** `renderFrames` + FFmpeg externo |
| OpenMontage | instalado no lab (`experiments/openmontage`, AGPLv3, commit 9327439d), repo do lab pertence a outro perfil (git *dubious ownership*) — **não modificado** |
| Vozes locais | SAPI Maria Desktop; **OneCore Maria/Daniel pt-BR** (WinRT, com timestamps por palavra) — saída 16 kHz mono |
| Fontes | Segoe UI Black, Bahnschrift, Arial Black, Impact (sistema). Fonte oficial da marca UNKNOWN |
| APIs / chaves | **nenhuma** (`.env` inexistente). Kling, Veo, Seedance, fal, ElevenLabs, Shotstack: NOT_TESTED |
| Conectores MCP | Canva/Amplitude/Atlassian/BigQuery/Hex exigem autorização; não usados |
| Marketing OS núcleo | build + **63/63 testes PASS** antes e depois (núcleo `src/` não alterado) |
| Dados reais | GRAND Sabão Líquido Premium 5 L: packshot (SHA e70a7e37…) e arte do rótulo; copy aprovada no lab |

### O que pôde ser testado de graça
Remotion-first completo; voz local; música/SFX procedurais; QC técnico; variant engine. Pago/bloqueado: IA de vídeo/imagem, TTS premium, Shotstack (sem conta).

## Teste A — Performance Ad (executado)
- Produto real, estrutura DR completa (hook → problema → tensão → mecanismo → como usar → benefícios → payoff → CTA), 36–42 s, 1080×1920, 30 fps.
- Variant engine: hooks **A / A2 / B / C**, bodies **1 / 2**, CTAs **A / B**, 2 estilos, 2 vozes, 2 pacings, legendas on/off → 192 variantes endereçáveis; 5 seleções renderizadas.
- Toda afirmação sobre o produto tem `claim_id` com fonte; **prova = NONE_AVAILABLE** (nada inventado); "Animação ilustrativa" na cena de mecanismo.

## Teste B — Faceless: **NOT_RUN** (arquitetura em architecture.md §6; requer tópico + fontes).

## Reproduzir
Ver [`experiments/remotion/README.md`](../experiments/remotion/README.md). Mídia (`final.mp4`, `mix.wav`) e assets da marca ficam fora do Git; manifests, timeline, QC e contact sheets são versionados.
