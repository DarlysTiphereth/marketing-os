---
name: compliance
description: Aplicar política interna conservadora antes da geração. Use quando categoria regulada, desconhecida ou solicitação safezone.
---

## PURPOSE

Aplicar política interna conservadora antes da geração.

## WHEN TO USE

Categoria regulada, desconhecida ou solicitação SafeZone.

## INPUTS

BrandContext; ProductKnowledge; plataforma/mercado.

## PRECONDITIONS

Identidade de marca e categoria preservadas.

## PROCESS

Executar precheck. SafeZone sem informação suficiente retorna REVIEW; categorias restritas retornam BLOCK. Não ocultar categoria ou interpretar ALLOW como permissão legal/publicação.

## OUTPUTS

ComplianceDecision versionada.

## FAILURE CONDITIONS

Bypass de categoria/política; geração após REVIEW/BLOCK.

## QUALITY CRITERIA

Decisão rastreável; conteúdo promocional bloqueado quando exigido.

## DEPENDENCIES

src/compliance/policy.ts; docs/review/KNOWN_LIMITATIONS.md.
