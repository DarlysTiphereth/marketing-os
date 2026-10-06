---
name: batch-variant-generation
description: Expandir matriz em variantes únicas usando código. Use quando combinações de ângulos, hooks e execuções visuais.
---

## PURPOSE

Expandir matriz em variantes únicas usando código.

## WHEN TO USE

Combinações de ângulos, hooks e execuções visuais.

## INPUTS

GenerationMatrix; BrandContext; ProductKnowledge; batch ID.

## PRECONDITIONS

Matriz PLANNED; dimensões suportadas.

## PROCESS

Executar produto cartesiano por código. Deduplicar conteúdo semântico + template; derivar UUIDs estáveis; registrar hipóteses, versões e duplicates_prevented.

## OUTPUTS

CreativeVariant[]; contagem de duplicatas prevenidas.

## FAILURE CONDITIONS

Referência inexistente; estado inválido; identidade duplicada.

## QUALITY CRITERIA

3×3×2 produz 18; aliases equivalentes não criam duplicatas.

## DEPENDENCIES

src/creative-factory/factory.ts; src/domain/identity.ts.
