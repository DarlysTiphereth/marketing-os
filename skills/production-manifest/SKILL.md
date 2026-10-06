---
name: production-manifest
description: Construir manifestos factuais e faceless sem gerar mídia. Use quando variante planejada que possui template reutilizável.
---

## PURPOSE

Construir manifestos factuais e faceless sem gerar mídia.

## WHEN TO USE

Variante planejada que possui template reutilizável.

## INPUTS

CreativeVariant; GenerationMatrix; ProductKnowledge; asset IDs.

## PRECONDITIONS

Assets da mesma marca/produto; fato validado.

## PROCESS

Compor template determinístico, shot list e specs. Marcar fixtures no conteúdo. Vincular claims às fontes; reutilizar template; manter prompts de mídia vazios nesta fase.

## OUTPUTS

ProductionManifest versionado.

## FAILURE CONDITIONS

Asset ausente; rosto identificável; claim sem fonte.

## QUALITY CRITERIA

Timeline de 18 segundos, schema válido e faceless_required=true.

## DEPENDENCIES

src/creative-factory/factory.ts; src/domain/assets.ts.
