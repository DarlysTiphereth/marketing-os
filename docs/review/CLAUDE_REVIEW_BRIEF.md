# Independent review brief

**Objective:** audit Marketing OS Foundation v0.1 for correctness and scope. This is a local TypeScript modular monolith, not the full marketing platform.

**Repository verification:** absolute root `C:\Marketing-OS`, branch `master`. Corrections are present in this working tree and are uncommitted. The initial status already contained the prior stabilization changes; this cycle adds only F-01–F-05. Do not review a different checkout. README/FILE_TREE, CLI/factory, .gitattributes and historical evidence were already changed by the earlier authorized cycle; they were not reworked here.

**Scope/DoD:** fixture product → provenance → compliance → minimal context → deterministic strategy → 3×3×2 → 18 UUID/versioned variants → asset reuse/cost/budget → 18 faceless manifests → QA PASS → READY_FOR_PRODUCTION → cost/efficiency reports. All 31 mandatory cases pass within 63 automated tests, including 21 P1 regressions. This cycle corrects only asset replay, CI evidence, unavailable replay inputs, real-clone line-ending proof and QA fixture placeholders. No v0.2/P2/OPTIONAL implementation.

**Critical constraints:** no real AI/media/publication/cloud/accounts; no invented business/product facts; no source → no claim; faceless; strict brand isolation; SafeZone REVIEW/BLOCK stops generation; no premium default; no actual pricing or invented savings. READY_FOR_PRODUCTION means planning only.

**Run from the root:** `pnpm install --frozen-lockfile`; `pnpm run build`; `pnpm run validate:skills`; `pnpm test`; `node --test dist/tests/p1-regressions.test.js`; `node scripts/ci-smoke.mjs`; `node scripts/assert-fixture-eol.mjs`; `git diff --check`. Smoke uses temporary fixture copies and checks GRAND 0, replay 0/idempotent, SafeZone REVIEW/BLOCKED 2, stale 3 and restored replay 0. No business fixture or existing output is mutated. npm equivalents are in README; npm is absent on the development host.

**Main files:** src/contracts/{schemas,ports}.ts; src/application/{generate,qa}.ts; src/creative-factory/factory.ts; src/domain/*.ts; src/compliance/policy.ts; src/cost/controls.ts; src/ai/*.ts; src/infrastructure/filesystem.ts; tests/*.test.ts; brands/ and products/.

**Known limits:** fixed fixture creativity/dimensions, per-batch asset counters, local JSON provenance, internal compliance policy, scanning filesystem repo, stale locks after crash, unsigned checksums, future billing/media unknown. See KNOWN_LIMITATIONS.md.

**Scrutiny:** unsupported claims anywhere in generated text, brand/source/asset identity, idempotency conflicts/concurrency, output integrity, status gates, soft/hard budgets, currency/version handling, cache isolation and honest metric denominators. Check REQUIREMENTS_TRACEABILITY.md and TEST_REPORT.md against actual source and tests.

**P1 follow-up:** review `.gitattributes` LF/-text precedence and the actual Git CRLF checkout test; fingerprint comparison against current brand/product/context/factory versions; independent comparison of all compliance fields except checked_at; STALE_INPUTS exit 3 with immutable snapshots; provenance validation on replay; template faceless-2 invalidation of earlier rendered content; REAL_DATA metadata preservation and absence from every public media text field, guarded by QA. REAL_DATA test records are isolated and do not modify GRAND business fixtures.

**Final findings:** F-01 reloads/validates assets when saved compliance is ALLOW, comparing all fields except derived usage_count. M1/M2a/M2b/M3a/M3b each verify STALE_INPUTS/3, no READY, identical snapshot bytes, no duplicate/partial state and replay 0 after restoration. F-03 extends this to deleted product/brand, retaining validation causes internally and exposing no path/stack via CLI. F-04 replaces checkout-index with actual commits and fresh clones under autocrlf=true/input/false plus eol=crlf; compares bytes/SHA for text and sources/raw and includes a failing-hash control without attributes. F-05 rejects TEST_FIXTURE/NOT_REAL_PRODUCT_DATA case-insensitively in every public media text field for non-fixture data, without changing metadata/provenance.

**Evidence/CI:** [test-results.tap](test-results.tap) records 63/63 PASS on Windows/Node 24.19.0; P1 alone is 21/21. Before the final fixes, that same P1 suite reproduced nine expected failures (12 PASS/9 FAIL). [p1-before-fix.tap](p1-before-fix.tap) is historical evidence for the earlier cycle, not the new F-04 proof. CI has four jobs: Node 24 Windows/Linux/macOS and Node 22.18.0 Linux. Each runs frozen install, build, Skills, all tests, CLI smoke, git ls-files --eol with LF/hash assertions, git diff --check, git diff --exit-code and git status --porcelain with a clean-state assertion. fail-fast=false, timeout=15 minutes, contents:read and persist-credentials=false. Remote runs remain pending: no Git remote is configured. Local dirty status is the reviewable uncommitted patch; the clean-state assertion applies to committed CI checkouts.

**Requested decision:** READY FOR CLAUDE RE-REVIEW. Verify F-01–F-05 in this root and decide whether CI may proceed. No CI approval or cross-platform execution is claimed. Deferred hardening includes golden template/policy hashes, broad inputFingerprint refactoring, readBytes, confirmed_by/confirmed_at and approvals.

Classify findings **P0 — critical**, **P1 — important**, **P2 — improvement**, **OPTIONAL — preference**. Include reproducer/evidence and a proportionate correction.

Do not propose rewrites based solely on style preference.
Do not introduce unnecessary infrastructure.
Prioritize correctness, requirements, security, cost efficiency and maintainability.
