# Independent review brief

**Objective:** audit Marketing OS Foundation v0.1 for correctness and scope. This is a local TypeScript modular monolith, not the full marketing platform.

**Scope/DoD:** fixture product → provenance → compliance → minimal context → deterministic strategy → 3×3×2 → 18 UUID/versioned variants → asset reuse/cost/budget → 18 faceless manifests → QA PASS → READY_FOR_PRODUCTION → cost/efficiency reports. All 31 mandatory cases pass within 42 automated tests; review package exists.

**Critical constraints:** no real AI/media/publication/cloud/accounts; no invented business/product facts; no source → no claim; faceless; strict brand isolation; SafeZone REVIEW/BLOCK stops generation; no premium default; no actual pricing or invented savings. READY_FOR_PRODUCTION means planning only.

**Run:** `pnpm install --frozen-lockfile`; `pnpm run build`; `pnpm test`; `pnpm run generate -- --brand grand --product test-product --angles 3 --hooks 3 --visuals 2 --budget 5`. Repeat command to verify replay. SafeZone must report REVIEW and zero variants; direct Node CLI exits 2 (package runners can wrap that as generic nonzero). npm equivalents are in README; npm is absent on the development host.

**Main files:** src/contracts/{schemas,ports}.ts; src/application/{generate,qa}.ts; src/creative-factory/factory.ts; src/domain/*.ts; src/compliance/policy.ts; src/cost/controls.ts; src/ai/*.ts; src/infrastructure/filesystem.ts; tests/*.test.ts; brands/ and products/.

**Known limits:** fixed fixture creativity/dimensions, per-batch asset counters, local JSON provenance, internal compliance policy, scanning filesystem repo, stale locks after crash, unsigned checksums, future billing/media unknown. See KNOWN_LIMITATIONS.md.

**Scrutiny:** unsupported claims anywhere in generated text, brand/source/asset identity, idempotency conflicts/concurrency, output integrity, status gates, soft/hard budgets, currency/version handling, cache isolation and honest metric denominators. Check REQUIREMENTS_TRACEABILITY.md and TEST_REPORT.md against actual source and tests.

Classify findings **P0 — critical**, **P1 — important**, **P2 — improvement**, **OPTIONAL — preference**. Include reproducer/evidence and a proportionate correction.

Do not propose rewrites based solely on style preference.
Do not introduce unnecessary infrastructure.
Prioritize correctness, requirements, security, cost efficiency and maintainability.
