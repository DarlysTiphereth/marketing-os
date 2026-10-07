# Requirements traceability

Caminhos de código abaixo são relativos a src/, salvo quando indicam docs/dados/testes. Números de teste correspondem aos prefixos 01–31 das quatro suítes. PASS significa comportamento implementado ou documento verificado no escopo v0.1. PREPARED significa interface/conceito intencionalmente sem execução externa; não implica provider real.

| § | Requirement | Implementation | Test / evidence | Status |
|---|---|---|---|---|
| 0 | Ordem de execução | docs/PLAN.md; docs/review/SELF_REVIEW.md | Gates e evidências no TEST_REPORT | PASS |
| 1 | Visão multi-brand | contracts/ports.ts; brands/ | 11; limites do escopo | PASS |
| 2 | Vertical slice exato | application/generate.ts | end-to-end persistence; 29/30 | PASS |
| 3 | 3×3×2 e rastreabilidade | creative-factory/factory.ts; domain/identity.ts | 07; end-to-end | PASS |
| 4 | Agents decide, code controls | domain/; application/; contracts/ports.ts | 04–10, 14–16; arquitetura | PASS |
| 5 | Hierarquia de custo | cost/controls.ts | CostRouter order | PASS |
| 6 | Eficiência de tokens | ai/ | 18–22; TOKEN_EFFICIENCY.md | PASS |
| 7 | Modular monolith | src/; ARCHITECTURE.md | build; revisão de dependências | PASS |
| 8 | Stack e inspeção | package.json; tsconfig.json; PLAN.md | build/test via pnpm | PASS |
| 9 | Estrutura não vazia | docs/FILE_TREE.txt | inventário real | PASS |
| 10 | AGENTS curto | AGENTS.md | inspeção manual | PASS |
| 11 | Core multi-brand compartilhado | application/generate.ts; compliance/policy.ts | 11 | PASS |
| 12 | BrandContext | contracts/schemas.ts; brands/*/context.json | 01 | PASS |
| 13 | ProductKnowledge sem fatos inventados | contracts/schemas.ts; domain/product.ts | 02/04; source tampering | PASS |
| 14 | SourceReference e hash | contracts/schemas.ts; domain/product.ts | 02; source tampering | PASS |
| 15 | CreativeHypothesis | contracts/schemas.ts; creative-factory/factory.ts | 07 | PASS |
| 16 | CreativeDNA experimental | contracts/schemas.ts; creative-factory/factory.ts | 07; descrição da estratégia | PASS |
| 17 | GenerationMatrix | creative-factory/factory.ts | 07/08 | PASS |
| 18 | CreativeVariant UUID/versionado | contracts/schemas.ts; creative-factory/factory.ts | 07/09 | PASS |
| 19 | Estados e transições | domain/status.ts | 05/06 | PASS |
| 20 | BatchProductionRequest | contracts/schemas.ts; cli/generate.ts | CLI arguments | PASS |
| 21 | Idempotência | application/generate.ts; infrastructure/filesystem.ts | 31; concurrent; conflict | PASS |
| 22 | Prevenção de duplicatas | creative-factory/factory.ts | 08; QA duplicates | PASS |
| 23 | Tiers TEMPLATE/HYBRID/PREMIUM | contracts/schemas.ts; application/generate.ts | 10/30; CLI TEMPLATE enforcement | PASS (contratos; CLI TEMPLATE) |
| 24 | Faceless | creative-factory/factory.ts; application/qa.ts | 10; QA faces | PASS |
| 25 | ProductionManifest/output specs | contracts/schemas.ts; creative-factory/factory.ts | 10; end-to-end | PASS |
| 26 | AssetRegistry/reuse | domain/assets.ts; infrastructure/filesystem.ts | 23/24 | PASS (snapshot por batch) |
| 27 | Master → variants futuro | contracts/ports.ts; NEXT_STEPS.md | revisão de contratos | PREPARED |
| 28 | AITask | contracts/schemas.ts | 19/22 | PASS |
| 29 | ModelRouter | contracts/ports.ts; ai/routing.ts | 25/26 | PASS (sem provider) |
| 30 | Fallback cheap/standard/premium | ai/routing.ts | 26 | PASS (controle; sem quality evaluator real) |
| 31 | ContextBuilder e perfis | ai/context.ts | 18 | PASS |
| 32 | PromptTemplate/Registry | ai/prompts.ts; contracts/schemas.ts | 19 | PASS |
| 33 | Structured outputs | ai/prompts.ts; ai/batching.ts | 22 | PASS (contrato/validação) |
| 34 | Output token limits | ai/prompts.ts | 19 | PASS |
| 35 | AI batching preserva IDs | ai/batching.ts | 22 | PASS (preparação; sem chamada) |
| 36 | Cache versionado | ai/cache.ts; infrastructure/filesystem.ts | 20/21 | PASS |
| 37 | AI usage ledger | contracts/schemas.ts; ai/usage-ledger.ts | 27 | PASS (sem uso real) |
| 38 | Token metrics | observability/metrics.ts | 28 | PASS |
| 39 | CostRouter | cost/controls.ts | CostRouter order; 15 | PASS |
| 40 | ProviderPricing sem preços reais hardcoded | contracts/schemas.ts; contracts/ports.ts; infrastructure/filesystem.ts | 17 | PASS |
| 41 | CostEstimator | cost/controls.ts | 14 | PASS |
| 42 | BudgetPolicy scopes | contracts/schemas.ts; cost/controls.ts | 15/16 | PASS (CLI PRODUCT/BATCH; demais scopes preparados) |
| 43 | Hard budget block | cost/controls.ts | 15 | PASS |
| 44 | Soft warning restringe premium | cost/controls.ts | 16 | PASS |
| 45 | Custo por categoria/creative | contracts/schemas.ts; creative-factory/factory.ts | 10/29 | PASS (planejamento) |
| 46 | Business metrics futuro | contracts/ports.ts | build; revisão de interface | PREPARED |
| 47 | Efficiency metrics | observability/metrics.ts | 30 | PASS |
| 48 | Savings honestas | observability/metrics.ts; COST_MODEL.md | 30 | PASS |
| 49 | QA determinístico | application/qa.ts | QA rejects; end-to-end | PASS |
| 50 | SafeZone REVIEW/BLOCK | compliance/policy.ts; contracts/schemas.ts | 12/13; CLI | PASS (política interna) |
| 51 | Sete Skills pequenas | skills/*/SKILL.md | validação estrutural local de 7 skills | PASS (validador bundled sem PyYAML) |
| 52 | Provider abstractions | contracts/ports.ts | build; revisão de contratos | PREPARED |
| 53 | Repository interfaces + filesystem | contracts/ports.ts; infrastructure/filesystem.ts | 01/02/17/20/24/31 | PASS |
| 54 | Logging estruturado sem secrets | observability/logger.ts | structured logs | PASS |
| 55 | Diretório de outputs | infrastructure/filesystem.ts | end-to-end persistence; integrity tampering | PASS |
| 56 | CLI funcional | cli/generate.ts | CLI executes; execução direta demo | PASS |
| 57 | Resumo honesto | cli/generate.ts; ExecutionSummarySchema | CLI executes; demo; 30 | PASS |
| 58 | Fixtures explícitas | brands/; products/; tests/helpers.ts | 01/02/10; source labels | PASS |
| 59 | 31 testes obrigatórios | tests/*.test.ts | 01–31 (63 testes totais na execução local) | PASS |
| 60 | CostReport | contracts/schemas.ts; application/generate.ts | 29 | PASS |
| 61 | EfficiencyReport | contracts/schemas.ts; observability/metrics.ts | 30 | PASS |
| 62 | Pacote de revisão | docs/review/ | inventário de 9 arquivos exigidos | PASS |
| 63 | Brief independente | CLAUDE_REVIEW_BRIEF.md | inspeção manual | PASS |
| 64 | Requirements traceability | este arquivo | conferência requisitos/testes | PASS |
| 65 | ADRs relevantes | DECISIONS.md | inspeção manual | PASS |
| 66 | Preparação v0.2 sem implementar | contracts/ports.ts; NEXT_STEPS.md | build; limites de escopo | PREPARED |
| 67 | Media factory interfaces | contracts/ports.ts | build; sem adapters reais | PREPARED |
| 68 | Async futuro desacoplado | GenerateBatch.execute; Job port | build; sem queue | PREPARED |
| 69 | PostgreSQL futuro | Repository ports | build; sem DB | PREPARED |
| 70 | n8n futuro | NEXT_STEPS.md | inspeção; sem n8n | PREPARED |
| 71 | Human approval específico à versão | VersionedApproval port; NEXT_STEPS.md | build; sem UI/aprovação ativa | PREPARED |
| 72 | Publication idempotente futura | PublicationRequest; PublishingProvider | build; sem publicação | PREPARED |
| 73 | Analytics IDs e métricas | contracts/ports.ts; CreativeVariantSchema | 07; build | PREPARED |
| 74 | Learning loop futuro | NEXT_STEPS.md | inspeção; sem learning agent | PREPARED |
| 75 | Creative promotion conceito | NEXT_STEPS.md | inspeção; nenhum threshold real | PREPARED |
| 76 | Secrets e env example | .env.example; .gitignore; logger.ts | structured logs; self-review | PASS |
| 77 | Restrições do que não fazer | AGENTS.md; package.json; scope docs | revisão de código/deps/outputs | PASS |
| 78 | Self-review obrigatório | SELF_REVIEW.md | correções + testes de integridade/concurrency | PASS |
| 79 | Definition of Done | application/generate.ts; review package; workflow | end-to-end; 01–31; F-02 | PASS local; remote CI/independent decision pending |
| 80 | Oito quality gates | TEST_REPORT.md | build/test/skills/docs, custo/tokens; four CI jobs configured | PASS local; cross-platform runs pending |
| 81 | Métricas mínimas | execution-summary.json; efficiency-report.json | 29/30; demo | PASS |
| 82 | Relatório final A–O | docs/FINAL_REPORT.md | inspeção e evidências | PASS |
| 83 | Prioridades e STOP | AGENTS.md; FINAL_REPORT.md | escopo entregue sem próximas fases | PASS |

## Independent audit stabilization (v0.1 only)

| Finding | Implementation | Acceptance tests | Evidence/status |
|---|---|---|---|
| P1-01 LF/CRLF hashes | .gitattributes: LF text; binaries and sources/raw -text | p1-regressions.test.ts: both-brand hash checks; F-04 real commits/clones, three Git configs and negative control; exact-byte raw original | PASS on Windows locally; remote matrix pending |
| P1-02 stale replay | application/generate.ts; cli/generate.ts | same inputs/later clock; changed version/content/category/compliance/policy/source bytes; exit 3; snapshot unchanged | PASS locally; STALE_INPUTS prevents READY |
| P1-03 REAL_DATA rendering | creative-factory/factory.ts (faceless-2); application/qa.ts | REAL_DATA contract retains classification/provenance and has no public markers; QA detects injected marker; old template replay rejected | PASS locally; business fixtures unchanged |
| F-01 asset replay | application/generate.ts; existing asset repository | Independent M1/M2a/M2b/M3a/M3b tests: exit 3, byte-identical snapshot, no partial/duplicate, restored replay 0; usage_count-only replay 0 | PASS local |
| F-02 CI evidence | .github/workflows/foundation-v01.yml; scripts/{ci-smoke,assert-fixture-eol}.mjs | Node 24 Windows/Linux/macOS; Node 22.18.0 Linux; frozen install/build/skills/tests/smoke/eol/diff/clean assertions | CONFIGURED, NOT EXECUTED remotely; scripts PASS local |
| F-03 unavailable replay inputs | application/generate.ts; existing CLI STALE_INPUTS mapping | M4a product/M4b brand deleted: cause retained, safe CLI exit 3, restored replay 0; M3b asset missing | PASS local |
| F-04 real clone proof | tests/p1-regressions.test.ts; .gitattributes | CRLF seed → git add/commit → fresh clone true/input/false + eol=crlf → byte/SHA comparisons; no-attributes control hash drifts | PASS local |
| F-05 fixture placeholders in real media | application/qa.ts | Mixed-case TEST_FIXTURE and NOT_REAL_PRODUCT_DATA inside deterministic REAL_DATA product media: 18 FAIL, metadata/provenance preserved; restoration 18 PASS | PASS local |
