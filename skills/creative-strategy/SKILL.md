---
name: creative-strategy
description: Planejar hipóteses experimentais a partir de fatos documentados. Use quando estratégia para um batch autorizado pelo precheck.
---

## PURPOSE

Planejar hipóteses experimentais a partir de fatos documentados.

## WHEN TO USE

Estratégia para um batch autorizado pelo precheck.

## INPUTS

BrandContext; ProductKnowledge; BatchProductionRequest.

## PRECONDITIONS

Compliance ALLOW; provenance válida.

## PROCESS

Selecionar apresentação factual, informação confirmada e leitura responsável. Na v0.1 usar estratégia determinística; separar hipótese de fato e preservar UNKNOWN para problema de audiência.

## OUTPUTS

CreativeHypothesis[]; CreativeDNA versionada.

## FAILURE CONDITIONS

Claim novo; tentativa de gerar após REVIEW/BLOCK.

## QUALITY CRITERIA

Hipóteses rastreáveis; DNA experimental sem alegação de causalidade.

## DEPENDENCIES

src/creative-factory/factory.ts; src/compliance/policy.ts.
