# Architectural decisions

- **ADR-001 Modular monolith.** Small modules share a process; no distributed infrastructure is needed for planning files.
- **ADR-002 Filesystem persistence.** Repository ports and atomic batch snapshots prove idempotency locally. Scan by key is deliberately simple; use a transactional index when scale requires it.
- **ADR-003 Provider abstraction.** Contracts cover LLM, images, video, TTS, rendering, publishing and analytics; no real adapter or vendor dependency exists.
- **ADR-004 Cheap-first control.** Reuse/code/cache precede paid AI. Premium requires failed cheaper quality checks, explicit business justification and allowed budget.
- **ADR-005 Minimal context.** Explicit field allowlists per profile keep full brand/product records out of hook tasks. Cache keys include tenant identity, all relevant versions and normalized input hash.
- **ADR-006 Deterministic fixture strategy.** Three factual experimental angles, three neutral hooks and two faceless executions prove orchestration without fabricating brand intelligence or using AI.
- **ADR-007 Sourced facts.** Product claim fields are `{text, source_ids}` rather than bare strings. Evidence hash + brand/product identity + exact fact membership is validated; no OCR/web ingestion.
- **ADR-008 TypeScript/Zod/node:test.** One runtime dependency and two development dependencies. node:test avoids a separate test framework. pnpm lockfile is canonical because npm is absent on this host; npm-compatible scripts remain available elsewhere.
- **ADR-009 Planning cost scope.** No paid operations means zero estimated v0.1 provider/media spend. Future media and actual billed amounts remain unavailable. Do not call a future video free.
- **ADR-010 Idempotency and integrity.** Keys are scoped by brand, conflicts are explicit, snapshots remain immutable. UUID v5 identities and artifact checksums preserve reproducibility and detect changed files.
