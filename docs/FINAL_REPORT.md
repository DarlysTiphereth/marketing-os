# MARKETING OS — FOUNDATION VERTICAL SLICE v0.1

## A. STATUS

**READY FOR CLAUDE RE-REVIEW.** Correção final F-01–F-05 aplicada em `C:\Marketing-OS`, branch `master`, no working tree, sem commit. Build, sete Skills e 63/63 testes passam localmente, incluindo 21 regressões P1. O workflow prevê quatro jobs: Node 24 em Windows/Linux/macOS e Node 22.18.0 em Linux. Execuções remotas continuam pendentes: nenhum remoto Git está configurado. A decisão de permitir CI pertence à revisão independente. O escopo continua v0.1, sem P2/OPTIONAL ou v0.2.

Correções: LF/-text via `.gitattributes`, provado com commit/clone real e controle negativo; replay compara fingerprint/compliance, revalida provenance e assets (ignorando apenas usage_count derivado); inputs ausentes/alterados retornam STALE_INPUTS/exit 3, preservando a causa internamente e o snapshot. REAL_DATA fica em metadata; QA rejeita também placeholders de fixture em mídia de dados reais. Template faceless-2 invalida snapshots anteriores sem sobrescrevê-los. Evidência e notas para Claude: review/TEST_REPORT.md e review/CLAUDE_REVIEW_BRIEF.md.

## B. WHAT WORKS

CLI offline; loading/validação de marcas e produtos; evidência com hash/identidade/fato; compliance precheck; contexto mínimo; estratégia determinística; matriz cartesiana e dedup; UUIDs/versionamento/decisões; manifestos faceless; reuse de templates; CostRouter/BudgetPolicy/CostEstimator; QA e transições; relatórios; snapshots atômicos; idempotência persistente/concorrente; cache/prompts/batching/usage ledger e métricas preparados e testados localmente.

## C. ARCHITECTURE

```text
CLI → GenerateBatch → Domain + Policy + CreativeFactory + Cost/AI controls
                  → QA → Reports → Repository interfaces → Filesystem
```

TypeScript + Zod + node:test; monólito modular com repositories/providers substituíveis. Diferenças de marca entram por configuração e política. Diagrama detalhado: review/ARCHITECTURE.md.

## D. FILE TREE

Árvore real, incluindo fixtures, módulos, Skills, testes, pacote e outputs locais: FILE_TREE.txt. Exclui node_modules, dist e .git por serem dependências/build/metadados.

```text
Marketing-OS/
├── AGENTS.md, README.md, .env.example, .gitignore, .gitattributes
├── .github/workflows/foundation-v01.yml
├── package.json, pnpm-lock.yaml, tsconfig.json
├── brands/{grand,safezone}/
├── products/{grand,safezone}/
├── src/{contracts,domain,application,creative-factory,compliance,cost,ai,observability,infrastructure,cli}/
├── tests/{helpers.ts,domain-factory.test.ts,cost.test.ts,ai-efficiency.test.ts,integration.test.ts,p1-regressions.test.ts}
├── skills/{product-intelligence,creative-strategy,batch-variant-generation,production-manifest,quality-control,compliance,cost-control}/SKILL.md
├── scripts/{validate-skills,ci-smoke,assert-fixture-eol}.mjs
├── docs/{PLAN.md,GRAND_DATA_NEEDED.md,FILE_TREE.txt,FINAL_REPORT.md,review/}
└── outputs/<batch_uuid>/{reports,snapshots,integrity.json,manifests/}
```

## E. VERTICAL SLICE

Produto sintético da GRAND → fonte confirmada → compliance ALLOW → contexto mínimo → três hipóteses → três hooks por hipótese → duas execuções visuais → **18 variantes únicas** → reutilização do template → **18 manifestos** → **QA PASS 18** → custo/eficiência → READY_FOR_PRODUCTION de planejamento.

Batch histórico demonstrado antes da estabilização: `688afbec-2ebf-5fb8-aaac-421fab0af457`. Saídas em `outputs/688afbec-2ebf-5fb8-aaac-421fab0af457/`, preservadas. Esse snapshot faceless-1 retorna STALE_INPUTS ao tentar replay com a versão atual; uma nova chave exige novo precheck. Os testes atuais confirmam 18 variantes/manifestos com QA PASS e faceless-2. SafeZone retorna REVIEW e retém a geração; categoria restrita retorna BLOCK. Nenhuma mídia foi gerada/publicada.

## F. COST ARCHITECTURE

CostRouter segue reuse → code → cache → cheap → standard → premium justificado. BudgetPolicy valida spend + estimate antes de gasto; hard bloqueia, soft avisa/restringe premium. CostEstimator usa ProviderPricing injetada/versionada com fonte e unidades. AIUsageLedger preserva custo/tokens/IDs e rejeita lançamentos duplicados. Não existe tabela real de preços nesta entrega.

Estimativa de planejamento: **BRL 0**, budget **BRL 5**, saldo **BRL 5**, status **OK**. Custo real faturado e mídia futura: **NOT_AVAILABLE_YET**. Detalhes: review/COST_MODEL.md.

## G. TOKEN ARCHITECTURE

ContextBuilder seleciona campos por perfil. PromptRegistry centraliza instruções/schema/versão e limites de output. Cache considera tenant, input e versões. Batching preserva IDs individuais e limita envelope. Dedup e expansão usam código. Roteamento barato primeiro; limites de output e validação estruturada testados sem provider real. Detalhes: review/TOKEN_EFFICIENCY.md.

## H. TEST REPORT

**Total 63 / passed 63 / failed 0 / skipped 0 / cancelled 0 / todo 0.** Cinco arquivos de testes, 31 casos obrigatórios e 32 verificações adicionais; 21 estão na suíte P1. Antes da correção F-01/F-03/F-05, essa suíte reproduziu nove falhas esperadas (21 total, 12 PASS, 9 FAIL). M1–M4b confirmam exit 3, ausência de READY, snapshots idênticos byte a byte, nenhum batch parcial/duplicado e replay exit 0 após restauração. M7 confirma QA FAIL e provenance/classificação preservadas. Smoke CLI e asserção LF/hashes também passam localmente. A evidência dos quatro jobs remotos permanece pendente. Detalhes: review/TEST_REPORT.md.

## I. EFFICIENCY REPORT

| Métrica da execução histórica demonstrada (antes de P1) | Valor |
|---|---:|
| variants_created / manifests | 18 / 18 |
| duplicates_prevented | 0 |
| deterministic_tasks | 86 |
| ai_tasks_simulated_or_required | 0 |
| assets_reused | 18 referências a 1 template sintético |
| assets_new | 0 |
| cache_hits / cache_misses | 0 / 0 (nenhum lookup AI) |
| input / output / cached tokens | 0 / 0 / 0 |
| TEMPLATE / HYBRID / PREMIUM planejados | 18 / 0 / 0 |
| deterministic_task_rate | 100% |
| template_media_rate | 100% dos manifestos planejados |
| estimated_cost | BRL 0, planejamento somente |
| actual_cost_if_available | NOT_AVAILABLE_YET |
| premium_task_rate / cache_hit_rate | NOT_AVAILABLE_YET (denominador zero) |
| savings | NOT_CALCULABLE_YET |

86 conta operações determinísticas instrumentadas do pipeline, não syscalls, linhas de código ou tempo de CPU. O teste de dedup injeta uma execução equivalente e confirma nove combinações evitadas; esse valor não é apresentado como métrica do demo normal.

## J. REQUIREMENT TRACEABILITY

review/REQUIREMENTS_TRACEABILITY.md mapeia **todos os §§0–83** a implementação, teste/evidência e status. Futuras capacidades permanecem PREPARED, não são apresentadas como integração funcionando.

## K. TECHNICAL DEBT

Scan de idempotência O(batches); recuperação manual de lock após crash; counters de assets por snapshot, sem materialização global; fonte JSON local; QA de template estrito; ausência de fsync/locking distribuído. São limites concretos para uma próxima iteração proporcional à necessidade, não infraestrutura antecipada.

## L. KNOWN LIMITATIONS

Fixtures sintéticas; dimensão máxima 3×3×2; estratégia informativa fixa; template é metadata, não mídia; compliance é política interna conservadora; nenhuma aprovação legal/publicação. Providers, mídia, billing, DB, queue, n8n, analytics e learning loop estão fora da entrega. Hashes locais não são assinatura antifraude. npm não está no PATH do ambiente atual; pnpm foi usado. Lista completa: review/KNOWN_LIMITATIONS.md.

## M. CLAUDE REVIEW PACKAGE

Entregar o repositório e `docs/review/`: ARCHITECTURE.md, REQUIREMENTS_TRACEABILITY.md, DECISIONS.md, KNOWN_LIMITATIONS.md, TEST_REPORT.md, COST_MODEL.md, TOKEN_EFFICIENCY.md, NEXT_STEPS.md, CLAUDE_REVIEW_BRIEF.md. SELF_REVIEW.md inclui correções internas. O brief solicita findings P0/P1/P2/OPTIONAL e prioriza correção, segurança, custo e manutenção sem rewrites de estilo.

## N. INFORMATION NEEDED FOR GRAND

Identidade/SKU/nome/categoria/variante/volume; descrição oficial; features/benefits com fonte; instruções/limites; warnings/regras regulatórias/claims proibidos; assets com direitos/hash/versão; BrandContext confirmado; objetivo/plataforma/mercado/audiência/CTA; budget e responsável. Preservar UNKNOWN até confirmação. Lista exata: GRAND_DATA_NEEDED.md.

## O. NEXT STEP

**Próxima ação: revisão independente do Claude sobre este working tree v0.1.** CI remoto e etapas seguintes dependem dessa revisão; nenhum deles foi iniciado neste ciclo.

STOP. As próximas fases não foram implementadas.
