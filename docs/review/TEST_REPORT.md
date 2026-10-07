# Test report — final v0.1 F-01–F-05 corrections, 2026-10-06

Environment: Windows/PowerShell; Node 24.19.0, pnpm 11.25.0, TypeScript 5.9.3, Zod 3.25.76, @types/node 24.19.1. The pnpm frozen lockfile captures exact resolved dependencies. npm is absent from PATH.

Repository: `C:\Marketing-OS`; branch: `master`; changes are in the uncommitted working tree. AGENTS.md and the named code/workflow files were read before editing. The initial status already contained earlier stabilization changes; no other project checkout/branch was used. Test-only fixture copies/Git repos are explicitly temporary and their cleanup verifies the resolved path.

Executed `pnpm run build`, `pnpm run validate:skills`, the P1 suite and `pnpm test` (strict TypeScript build + node:test): **63 total, 63 passed, 0 failed, 0 skipped/cancelled/todo**. Full-suite TAP evidence is in [test-results.tap](test-results.tap), captured from `pnpm test` with `NODE_OPTIONS=--test-reporter=tap` (environment restored afterward). No network/provider calls. Build/tests leave only ignored dist/temp output, with no edits to business fixtures or existing snapshots.

| Suite | Cases | Mandatory coverage |
|---|---:|---|
| tests/domain-factory.test.ts | 16 | 01–13, 23–24 |
| tests/cost.test.ts | 7 | 14–17, 29 |
| tests/ai-efficiency.test.ts | 10 | 18–22, 25–28, 30 |
| tests/integration.test.ts | 9 | 31 + end-to-end/CLI/concurrency/security/QA |
| tests/p1-regressions.test.ts | 21 | Prior three P1 findings + final F-01/F-03/F-04/F-05 acceptance |
| Total | 63 | All 31 mandatory cases + 32 additional checks |

Additional checks cover altered source hashes/fixture labels, currency/nonfinite amounts, CostRouter ordering, duplicate IDs, output integrity, concurrent requests, key conflicts, full persisted reports, modified QA content/face rules/missing assets/stale versions, empty/truncated matrix, malformed CLI arguments, path traversal and secret-safe logging.

Historical source CLI demo before stabilization: `pnpm run generate -- --brand grand --product test-product --angles 3 --hooks 3 --visuals 2 --budget 5`, exit 0. Batch `688afbec-2ebf-5fb8-aaac-421fab0af457`: 18 variants, 18 manifests, QA PASS 18/REVIEW 0/FAIL 0; planning READY_FOR_PRODUCTION. Estimated planning cost BRL 0; budget BRL 5; tokens 0; 86 deterministic tasks. Fixture metadata only, no media. This faceless-1 snapshot is preserved and is stale under the corrected faceless-2 template; new planning requires a new reviewed idempotency key.

Current automated CLI checks confirm identical replay exit 0, SafeZone REVIEW exit 2 with zero variants and stale replay exit 3 with STALE_INPUTS. The stale CLI test repeats the request twice and never receives READY. Node CLI defines these exit codes; package runners can wrap nonzero codes. Domain test 13 continues to confirm restricted-category BLOCK.

## Reproduction and P1 acceptance

Before final verification, the first ten new tests were run against an isolated copy of the pre-fix HEAD implementations, without .gitattributes: **10 total / 2 passed / 8 failed as expected**, exit 1. [p1-before-fix.tap](p1-before-fix.tap) preserves this evidence. The original workspace was not reset. Failures reproduced CRLF source hash drift, stale product/category/compliance/policy/provenance replay, and REAL_DATA text leakage.

The historical TAP above predates the real-clone test and does not prove F-04. In this cycle, before changing production code, the expanded P1 suite reproduced **21 total / 12 passed / 9 failed as expected**: five asset mutations, product/brand deletion and two real-data fixture placeholders. With the final corrections, all **21 P1 cases pass**:

Pre-commit privacy preparation: p1-before-fix.tap replaces only the machine-specific temporary workspace prefix with <TEMP_WORKSPACE> (location fields) and file:///TEMP_WORKSPACE/ (stack URLs). Spaces on four otherwise empty lines were removed to satisfy git diff --cached --check. Test filenames, line/column references, errors, assertions, counts, durations and outcomes are unchanged. This is sanitized historical evidence, not a rerun. README also omits the local user-profile path to the bundled pnpm executable.

- P1-01/F-04: both-brand evidence/template hashes match actual content; altered evidence is rejected. An isolated repo starts with CRLF ordinary text and mixed-line-ending raw bytes, then executes git init/add/commit and three fresh git clones with autocrlf=true/input/false and eol=crlf configured before checkout. All protected text bytes/SHA match normalized originals; sources/raw/original.txt retains exact bytes/SHA; each clone generates 18 QA PASS manifests. A subsequent commit removes attributes only in the temporary seed: its fresh autocrlf=true clone contains CRLF evidence and a different SHA, proving the test detects missing protection. No checkout-index is used.
- P1-02: unchanged inputs return the same snapshot/IDs at a later check time. Changed product version/content/category, brand compliance profile, independent saved policy version or source bytes cause STALE_INPUTS. The original batch remains unchanged and no duplicate is created. Current compliance compares all fields except checked_at.
- P1-03: an isolated REAL_DATA contract case keeps REAL_DATA metadata, VERIFIED status, MANUAL provenance, source hashes and sourced claims; all public media text is marker-free and 18 creatives pass QA. An injected marker in a video prompt causes QA FAIL. Pre-fix template fingerprints cannot replay after faceless-2.
- F-01/F-03: five independent asset mutation tests and two input deletion tests require service STALE_INPUTS and direct Node CLI exit 3. Current assets use the ordinary repository validation; the comparison ignores only derived usage_count. All saved output bytes remain identical, there is one batch and no partial state. Validation failures retain Error.cause; CLI includes neither local paths nor stacks. Each input is restored in finally and subsequent CLI replay returns 0/idempotent_replay=true with the same batch. A separate usage_count-only test passes replay.
- F-05: mixed-case tEsT_fIxTuRe and nOt_ReAl_PrOdUcT_dAtA in an isolated REAL_DATA product name flow through the unchanged deterministic template and yield 18 QA FAIL. Both tests preserve REAL_DATA metadata and source references/hashes; provenance remains valid. Restoring the input and generating with a fresh key restores 18 QA PASS. Legitimate TEST_FIXTURE content still passes existing end-to-end cases.

| Local command | Result |
|---|---|
| pnpm run build | exit 0; strict TypeScript PASS |
| pnpm run validate:skills | exit 0; 7/7 PASS |
| node --test dist/tests/p1-regressions.test.js | exit 0; 21/21 PASS, 0 FAIL/skip/cancel/todo |
| pnpm test | exit 0; 63/63 PASS, 0 FAIL/skip/cancel/todo |
| node scripts/ci-smoke.mjs | exit 0; GRAND 0, identical replay 0, SafeZone 2, stale replay 3, restored replay 0 |
| node scripts/assert-fixture-eol.mjs | exit 0; git ls-files --eol evidence, attrs text/LF, index/worktree LF and source/template byte hashes; 10 textual fixtures |
| git diff --check | exit 0; no whitespace errors |

No dependency, public schema, compliance rule, architecture or P2/OPTIONAL feature changed. Only the five requested review documents were updated in this cycle, plus the directly related TAP evidence. Earlier README/FILE_TREE changes remain untouched.

## Mutation results

| Mutation | Result | Restoration |
|---|---|---|
| M1 faceless_verified=false | STALE_INPUTS; CLI 3; no READY | original catalog; replay 0/idempotent |
| M2a catalog content_hash tampered | STALE_INPUTS; CLI 3; no READY | original catalog; replay 0/idempotent |
| M2b template bytes changed | STALE_INPUTS; CLI 3; no READY | original bytes; replay 0/idempotent |
| M3a asset removed from catalog | STALE_INPUTS; CLI 3; no READY | original catalog; replay 0/idempotent |
| M3b physical template deleted | STALE_INPUTS; CLI 3; no READY | original bytes; replay 0/idempotent |
| M4a product deleted | STALE_INPUTS; CLI 3; no READY | original product; replay 0/idempotent |
| M4b brand deleted | STALE_INPUTS; CLI 3; no READY | original brand; replay 0/idempotent |
| M7 REAL_DATA + TEST_FIXTURE | QA FAIL 18; no READY; provenance preserved | original product; new-key QA PASS 18 |
| F-05 REAL_DATA + NOT_REAL_PRODUCT_DATA | QA FAIL 18; no READY; provenance preserved | original product; new-key QA PASS 18 |

M1–M4b assert snapshot bytes unchanged and no duplicate/new/partial batch. M7 asserts the specific QA placeholder issue, so a template mismatch alone cannot satisfy the test. All mutations occur in isolated fixture copies; every original input is restored.

## Quality gates

| Gate | Status | Evidence |
|---|---|---|
| 1 Build | PASS | Strict tsc compilation within pnpm test |
| 2 Tests | PASS | 63/63 locally; cases 01–31 present |
| 3 Domain | PASS | Provenance, UUIDs, matrix, versions, status and manifests |
| 4 Cost | PASS | Estimator, hard/soft limits, currency, routing and honest planning scope |
| 5 Token efficiency | PASS | Minimal fields, bounded prompts, versioned cache, structured batching and no real token usage |
| 6 Multi-brand isolation | PASS | Test 11 + context/assets/source checks |
| 7 Compliance | PASS | SafeZone REVIEW/BLOCK halts generation; internal policy only |
| 8 Review package | PASS | Nine required documents plus self-review; traceability §§0–83 |

Seven Skills pass repo-specific validation via `pnpm run validate:skills`. Bundled skill-creator quick_validate.py was attempted but cannot import PyYAML in this runtime. The replacement validates the two plain scalar frontmatter fields, names/descriptions, all nine required sections and absence of TODO scaffolds; it intentionally rejects richer YAML syntax.

## Cross-platform CI gate

`.github/workflows/foundation-v01.yml` defines four jobs: Node 24 on windows-latest/ubuntu-latest/macos-latest and Node 22.18.0 on ubuntu-latest. Each runs pnpm install --frozen-lockfile, build, validate:skills, all tests, CLI smoke and git ls-files --eol plus assertions. Final checks are git diff --check, git diff --exit-code and git status --porcelain with an assertion that fails on any tracked/untracked change. fail-fast=false, timeout=15 minutes, contents:read and checkout persist-credentials=false. Configuration uses the action versions from the prior stabilization; no new infrastructure.

**Remote executions are NOT VERIFIED:** git remote is empty. No remote/cloud was provisioned or CI triggered. Local Windows/Node 24.19.0 results do not establish Linux/macOS/Node 22.18 runtime results. git diff --exit-code/clean-status are CI checks for a committed checkout; the current local dirty state is the reviewable patch and was explicitly inspected, not hidden or reset.

Final status: **READY FOR CLAUDE RE-REVIEW**. F-01–F-05 are implemented and locally verified; the independent reviewer decides whether CI may proceed. CI approval is not claimed.

Foundation self-review corrections are in SELF_REVIEW.md; this P1 follow-up is recorded above. This report does not claim a completed follow-up Claude review, legal/platform approval, billed cost accuracy, media production validation or completed remote CI.
