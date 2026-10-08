# Análise de escala — modelagem (não executada)

Base MEASURED: um vídeo de ~40 s leva **~170–190 s de parede** no laptop atual (frames ≈ 97–99 s com 4 workers de Chrome; encode x264 `slow` 54–84 s; áudio ~6 s; QC ~11 s). Tudo o mais nesta página é **INFERRED** a partir disso.

Capacidade de 1 laptop (sequencial, 24 h): ≈ 450–500 vídeos/dia teóricos; realista ~150–250/dia (RAM de 7,7 GiB limita o paralelismo do Chrome; máquina de uso pessoal).

| Volume/dia | Topologia sugerida | Fila/retry | Storage (≈12–25 MB/vídeo) | Observações |
|---|---|---|---|---|
| **10** | Laptop atual, CLI `produce.ts` em loop | não precisa; idempotência por `variant_id` | 0,25 GB/dia | Gargalo é aprovação humana de claims/criativo, não render. |
| **50** | 1 máquina dedicada (8+ vCPU, 16 GB) | fila em arquivo/SQLite + retry 2× com backoff | 1,2 GB/dia | Trocar encode para `preset medium`; cache de bundle Remotion persistente. |
| **100** | 1–2 workers | fila persistente (BullMQ/Redis ou SQS); jobs = {variant_id, stage} | 2,5 GB/dia → object storage (S3/R2) com lifecycle | Separar estágios (TTS / IA / render / QC) para retry parcial. |
| **500** | 4–6 workers render + workers de API separados | rate-limit por provider (token bucket), circuit breaker, DLQ | 12 GB/dia (~360 GB/mês) | Considerar Remotion Lambda/Cloud Run; licença Remotion Automators (US$ 0,01/render). |
| **1.000** | autoscaling (Lambda/Cloud Run/K8s) | idem + priorização por experimento | 25 GB/dia (~750 GB/mês; expirar masters após publicação) | Custo dominado por IA de mídia, não por render (ver cost-analysis). |

## Controles necessários (independentes do volume)
- **Idempotência/dedup:** `variant_id = hash(template, seleção)` já implementado; acrescentar hash perceptual do MP4 e similaridade de roteiro para bloquear quase-duplicatas (anti-spam de plataforma).
- **Cache em camadas:** bundle Remotion (por hash do código), TTS (por hash de texto+voz — implementado), clipes de IA (por hash de prompt+seed+modelo), música/SFX (por seed).
- **Rate limits / quotas:** por provider e por chave; orçamentos rígidos *antes* do gasto (o núcleo v0.1 já tem cost controls por batch — reutilizar).
- **Observabilidade:** `run.log` JSONL já emite estágio/tempo; em escala, exportar para métricas (latência por estágio p50/p95, taxa de falha por provider, custo por variante aprovada).
- **Retry:** só estágios idempotentes; gerações de IA com `seed` registrada; falha de QC técnico → re-render automático 1×; falha criativa → fila humana (máx. 2 ciclos automáticos).
- **Capacidade de aprovação humana** é o gargalo real acima de ~50/dia: claims `SOURCED_PENDING_APPROVAL` precisam ser aprovados uma vez por produto, não por vídeo.

## Riscos de escala
Spam/conteúdo repetitivo (políticas de originalidade das plataformas), deriva de qualidade sem amostragem humana, custos de IA com retakes, licença Remotion/AGPL do OpenMontage em uso comercial/SaaS.
