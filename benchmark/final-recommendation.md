# Recomendação final — Benchmark 001

## Decisão: **KEEP_AS_OPTIONAL** (OpenMontage) · arquitetura-alvo **HYBRID** com núcleo Remotion-first

Status da decisão: **provisória** — baseada em 1 stack executada no conceito atual (Remotion-first), evidência não controlada do OpenMontage (lab B002) e NOT_TESTED para OM+Remotion e IA. Reavaliar quando A/B rodarem sobre o mesmo `creative.v1`.

### Por quê
1. **O que o OpenMontage oferece, o Marketing OS já tem ou precisa ter por conta própria.** O valor observado do OM no lab foi *processo* (checkpoints, schemas, revisão persistida) — o núcleo v0.1 já faz planejamento determinístico, claims com proveniência, budgets, idempotência e manifests, com 63 testes. Adotar o OM como orquestrador duplicaria isso e traria **AGPLv3** para o caminho crítico de um produto que pode virar SaaS (risco de licença UNKNOWN, ver lab `OPENMONTAGE_LICENSE_NOTES.md`).
2. **Sem chaves de provider, o teto visual do OM = teto do HTML/GSAP que o agente escreve** (registry com 0/23 imagegen, 0/31 videogen, 0/13 TTS configurados — OBSERVED no lab). Não há ganho de pixel atribuível à ferramenta.
3. **Batch é o requisito central e o OM não é nativo nisso** (DOCUMENTED pelo próprio OM; OBSERVED: pipelines de vídeo único). O Remotion-first deste repo já endereça 192 variantes com IDs determinísticos e cache, e renderizou 7 runs.
4. **O bloqueio que justificava procurar alternativas ao Remotion foi resolvido nesta rodada:** `renderFrames` + FFmpeg externo contorna o compositor bloqueado pelo Windows Application Control, e o gate `frames decodificados == timeline` elimina o problema de duração do 001B.
5. **Mantê-lo opcional** (e não substituí-lo de vez) porque: HyperFrames pode ser um renderer alternativo útil; o registry de providers do OM é uma boa referência para o Asset Router; e a comparação controlada ainda não foi feita.

### O que NÃO concluímos
- Que Remotion produz anúncios melhores que OpenMontage (mesma autoria = pixels parecidos; a diferença é de arquitetura/escala).
- Que o criativo atual é bom o suficiente para mídia paga: **não é** (7,0/10, não aprovado).
- Qualquer número de retenção/CTR/ROAS.

## Próximos passos (em ordem; itens pagos aguardam sua aprovação)

| # | Passo | Custo | Aprovação |
|---|---|---|---|
| 1 | Aprovar/editar os **claims `SOURCED_PENDING_APPROVAL`** (rótulo/packshot: "Remove as sujeiras", "Roupas mais limpas e perfumadas", "Cuida das suas roupas", "Fórmula avançada…", modo de usar, "Encomende") — o brief anterior do lab proibia acrescentar claims do rótulo ao layout; esta rodada os usou internamente por serem a única fonte de benefícios | 0 | **sua decisão** |
| 2 | Fornecer **prova verdadeira** se existir (avaliações reais com permissão, testes, fotos de uso) — sem isso o slot de prova continua vazio | 0 | dados |
| 3 | **Voz premium** no hero (maior gargalo de credibilidade) | ElevenLabs Multilingual ≈ US$ 0,10/1.000 car. × ~600 car. × 2 vozes ≈ **US$ 0,12**; máx. US$ 1 | **sim** — chave em `.env` |
| 4 | **Hybrid real:** trocar só hook-a2 e b1-problem por clipes i2v de 5 s (A/B de 2 providers) mantendo o resto idêntico | Veo 3.1 Lite (fal) 4 clipes × 5 s × US$ 0,03 = US$ 0,60; Kling v3 Pro 4 × 5 × 0,112 = US$ 2,24 → **máx. ≈ US$ 3** com retakes | **sim** — chave fal em `.env` |
| 5 | Stack A/B controlados: adapter `creative.v1 → OpenMontage` e render HyperFrames do mesmo conceito, QC idêntico | 0 | não (local) |
| 6 | Teste B faceless (30–60 s; 2 aberturas × 2 estruturas × 2 estilos) com tópico + fontes | 0 local / TTS opcional | escolha do tópico |
| 7 | Promover: `RendererPort` em `src/contracts`, adapter `ProductionManifest → creative.v1` com testes | 0 | não |

Preços são de fontes secundárias (set–out/2026) — confirmar nas páginas oficiais antes do gasto. Nenhuma chave existe nesta máquina hoje (não há `.env`).
