---
name: quality-control
description: Aplicar QA determinístico antes de mudar status. Use quando manifestos e variantes prontos para revisão.
---

## PURPOSE

Aplicar QA determinístico antes de mudar status.

## WHEN TO USE

Manifestos e variantes prontos para revisão.

## INPUTS

QAInput com marca, produto, matriz, compliance, assets e custo.

## PRECONDITIONS

Variantes em QA_REVIEW; provenance já verificada.

## PROCESS

Verificar schema, IDs, versões, claims, assets, duplicatas, budget e conteúdo contra template. PASS permite READY_FOR_PRODUCTION; REVIEW/FAIL bloqueiam.

## OUTPUTS

QAReport; transições explícitas.

## FAILURE CONDITIONS

Falha de schema, isolamento, fonte, conteúdo ou custo.

## QUALITY CRITERIA

Nenhuma variante com FAIL/REVIEW recebe READY_FOR_PRODUCTION.

## DEPENDENCIES

src/application/qa.ts; src/domain/status.ts.
