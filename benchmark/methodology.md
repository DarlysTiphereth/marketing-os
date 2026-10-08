# Metodologia — Benchmark 001

## Princípios

1. **Evidência antes de opinião.** Toda afirmação recebe um rótulo:
   `DOCUMENTED` (fonte externa/manual) · `OBSERVED` (visto em execução) · `MEASURED` (número medido por ferramenta) · `INFERRED` (dedução/julgamento do agente) · `NOT_TESTED` · `UNKNOWN`.
2. **Mesmo objetivo criativo, mesmo contrato.** Todas as stacks consomem o mesmo `creative.v1` (`experiments/remotion/src/schema.ts`) e os mesmos assets com SHA-256 verificado. Uma stack só é comparável se renderizar a partir desse contrato (ou se a divergência estiver documentada).
3. **Leading indicators, não ROAS.** Sem dados de mídia, avaliamos indicadores criativos (hook, clareza, ritmo etc.) e métricas mensuráveis do arquivo (tempo até a 1ª fala, cortes/10 s, palavras na tela/s). Nenhum número de performance é inventado.
4. **No source → no claim.** Cada afirmação sobre o produto referencia um `claim_id` com fonte (rótulo, packshot, copy aprovada). O validador rejeita `claim_refs` desconhecidos antes do render.
5. **Custos reais ou UNKNOWN.** Gasto em API é medido (0 nesta rodada). Tokens do agente, energia e tempo de autoria humana/agente: `UNKNOWN`.

## Pipeline medido (Stack C — Remotion-first)

```
creative.json ─► validate (zod + claims) ─► expand(variant) ─► TTS local (cache) ─► timeline (duração = fala medida)
   ─► áudio (música procedural + SFX + ducking + loudnorm 2-pass + limiter) ─► Remotion renderFrames (Chrome headless)
   ─► FFmpeg externo (x264 crf18, yuv420p TV range, AAC 48k) ─► QC técnico ─► contact sheet ─► manifests
```

## Quality gates

### Technical QC (MEASURED — `pipeline/qc.ts`, bloqueante)

| Check | Limiar |
|---|---|
| resolução / aspect | 1080×1920 / 9:16 |
| fps | 30/1 nominal **e** médio (o Benchmark 001B do lab falhou aqui) |
| codec | H.264, `yuv420p` (TV range) |
| frames decodificados | == frames da timeline |
| duração | 30–46 s |
| áudio | AAC 48 kHz estéreo |
| loudness integrado | −14 ±1 LUFS |
| true peak | ≤ −1,0 dBTP |
| LRA | ≤ 12 LU (WARN) |
| black frames | nenhum ≥ 0,1 s |
| vídeo congelado ("imagem parada") | nenhum ≥ 1,5 s |
| silêncio estranho | nenhum < −45 dB por ≥ 0,6 s |
| hook | primeira fala ≤ 0,5 s; texto no frame 0 |
| cena máxima | ≤ 7,5 s (WARN) |
| safe zones / legendas | regra estática de layout (y ∈ [140,1440] conteúdo; legendas y ∈ [1470,1570]) — **não é análise de pixel** |

### Visual QC (OBSERVED, agente)
Contact sheet automático (início/meio/fim de cada cena) inspecionado pelo agente: continuidade, enquadramento, legibilidade, contraste, deformação do produto, branding. Limite: amostragem, não playback contínuo.

### Creative QC (INFERRED, agente, 0–10)
HOOK · CLARITY · PACING · CURIOSITY · VISUAL VARIETY · BENEFIT CLARITY · CREDIBILITY · EMOTIONAL IMPACT · CTA · OVERALL.
Regra: `OVERALL < 8` → não aprovado automaticamente; identificar o ponto mais fraco; no máximo **2 ciclos automáticos** de melhoria. Notas do agente não substituem teste com público.

## Escala de pontuação do scorecard
1–10 por critério; cada célula carrega o rótulo de evidência. `NOT_TESTED` não recebe nota numérica.

## Controles de comparação
- Mesmos assets (hash), mesma copy/claims, mesma duração-alvo, mesma resolução/fps.
- Renderers diferentes podem ter liberdade visual (o pedido permite), mas o **objetivo criativo** e a estrutura de cenas são fixos.
- Comparações com o Benchmark 002 (OpenMontage, lab) **não são controladas**: conceito de 15 s, sem DR completo, briefing diferente.

## O que este benchmark NÃO mede
Retenção real, CTR, CVR, ROAS; inteligibilidade da voz por ouvinte humano; preferência estética de público; comportamento em upload real nas plataformas.
