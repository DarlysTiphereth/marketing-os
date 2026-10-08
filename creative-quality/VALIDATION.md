# Validação de preservação — não é aprovação criativa

Windows / Node 24.19.0, 2026-10-08. Branch isolado baseado em `011fcd3`.

| Verificação | Resultado |
|---|---|
| Build | PASS |
| Testes do monólito em saída recompilada limpa | 71/71 PASS, 0 fail/skipped/cancelled/todo |
| Testes ops/static | 18/18 PASS, 0 fail/skipped/cancelled/todo |
| Skills | 7/7 PASS |
| Smoke Foundation | PASS: GRAND, replay idêntico, SafeZone, stale exit 3, restaurado |
| EOL/hashes de fixtures | PASS: 10 fixtures textuais |
| Diff check | PASS |
| Render final | Dois MP4 reais de 7s; gates técnicos individuais em EVIDENCE.json |
| Board visual | Frames reais, storyboard e comparação em 0,5s; mídia atual vinculada aos hashes |

Oito regressões novas cobrem conceitos genéricos/narrativa inconsistente, limite de duas direções, assets ausentes, hashes/direitos não verificados, stock usado indevidamente como prova de produto, separação de gates, aprovação nominal/datada e invalidação por alteração de conceito/asset/vídeo.

Total deste branch: **89 testes, 89 PASS, zero falhas**. Os testes commerce do PR #1 não estão no código deste branch e não entram nessa contagem. A primeira execução encontrou seus artefatos antigos em `dist`; a contagem válida acima foi obtida após remover apenas a saída de compilação gerada/ignorada dentro do workspace e recompilar. Nenhum código ou mídia anterior foi descartado.

CREATIVE_QC, BRAND_QC e HUMAN_APPROVAL permanecem PENDING; COMMERCE_QC BLOCKED; produção em escala suspensa. Nenhum teste automatizado mede desejo, qualidade de agência ou performance de vendas. A crítica visual consta em AUDIT.md; a decisão humana ainda precisa ser fornecida.
