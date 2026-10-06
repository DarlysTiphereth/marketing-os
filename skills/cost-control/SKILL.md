---
name: cost-control
description: Escolher execução econômica e respeitar budgets antes de gasto. Use quando estimativa, roteamento ou revisão de custo de batch/task.
---

## PURPOSE

Escolher execução econômica e respeitar budgets antes de gasto.

## WHEN TO USE

Estimativa, roteamento ou revisão de custo de batch/task.

## INPUTS

BudgetPolicy; estimativa; spend; moeda; ProviderPricing versionada.

## PRECONDITIONS

Nenhum preço atual presumido; moeda compatível.

## PROCESS

Priorizar reuse, code, cache, cheap, standard e premium justificado. Bloquear hard limit; warning restringe premium. Distinguir custo de planejamento de mídia futura desconhecida; savings sem baseline ficam NOT_CALCULABLE_YET.

## OUTPUTS

Rota, decisão de budget e CostReport.

## FAILURE CONDITIONS

Gasto excedente; currency mismatch; premium sem justificativa; savings inventadas.

## QUALITY CRITERIA

Estimativa rastreável; zero chamadas pagas na v0.1.

## DEPENDENCIES

src/cost/controls.ts; src/ai/routing.ts; docs/review/COST_MODEL.md.
