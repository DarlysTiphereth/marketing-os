---
name: product-intelligence
description: Validar ProductKnowledge e suas fontes antes de planejar conteúdo. Use quando novo produto ou atualização de evidência.
---

## PURPOSE

Validar ProductKnowledge e suas fontes antes de planejar conteúdo.

## WHEN TO USE

Novo produto ou atualização de evidência.

## INPUTS

ProductKnowledge; SourceRepository.

## PRECONDITIONS

Produto identificado por marca; fontes locais legíveis.

## PROCESS

Validar schema, hash SHA-256, identidade da fonte e correspondência exata de cada fato. Preservar UNKNOWN; não completar lacunas por inferência.

## OUTPUTS

ProductKnowledge validada ou erro explícito.

## FAILURE CONDITIONS

Fonte ausente/alterada; claim sem evidência; fixture apresentada como real.

## QUALITY CRITERIA

Todo fato referencia uma fonte verificável; isolamento de marca.

## DEPENDENCIES

src/domain/product.ts; src/contracts/schemas.ts.
