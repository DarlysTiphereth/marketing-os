# Test report — 2026-10-05

Environment: Windows/PowerShell; Node 24.19.0, pnpm 11.25.0, TypeScript 5.9.3, Zod 3.25.76, @types/node 24.19.1. The pnpm frozen lockfile captures exact resolved dependencies. npm is absent from PATH.

Executed `pnpm test` (strict TypeScript build + node:test): **42 total, 42 passed, 0 failed, 0 skipped/cancelled**. Final build plus TAP test execution is preserved in [test-results.tap](test-results.tap); node:test runs in approximately 2–3s, excluding TypeScript compile. No network/provider calls in tests. Fixtures are copied to isolated temporary directories; cleanup checks the resolved path.

| Suite | Cases | Mandatory coverage |
|---|---:|---|
| tests/domain-factory.test.ts | 16 | 01–13, 23–24 |
| tests/cost.test.ts | 7 | 14–17, 29 |
| tests/ai-efficiency.test.ts | 10 | 18–22, 25–28, 30 |
| tests/integration.test.ts | 9 | 31 + end-to-end/CLI/concurrency/security/QA |
| Total | 42 | All 31 mandatory cases |

Additional checks cover altered source hashes/fixture labels, currency/nonfinite amounts, CostRouter ordering, duplicate IDs, output integrity, concurrent requests, key conflicts, full persisted reports, modified QA content/face rules/missing assets/stale versions, empty/truncated matrix, malformed CLI arguments, path traversal and secret-safe logging.

Actual source CLI demo: `pnpm run generate -- --brand grand --product test-product --angles 3 --hooks 3 --visuals 2 --budget 5`, exit 0. Batch `688afbec-2ebf-5fb8-aaac-421fab0af457`: 18 variants, 18 manifests, QA PASS 18/REVIEW 0/FAIL 0; planning READY_FOR_PRODUCTION. Estimated planning cost BRL 0; budget BRL 5; tokens 0; 86 deterministic tasks. Fixture metadata only, no media.

Final source CLI verification confirmed GRAND idempotent replay and SafeZone REVIEW with zero variants, batch `02b2d150-1143-58e1-a339-22c102feaf96`. Node CLI returns 2 for a withheld batch; pnpm reports the child exit 2 and may itself return a generic nonzero status. Automated direct Node CLI test confirms exit 2. Domain test 13 confirms restricted-category BLOCK.

## Quality gates

| Gate | Status | Evidence |
|---|---|---|
| 1 Build | PASS | Strict tsc compilation within pnpm test |
| 2 Tests | PASS | 42/42; cases 01–31 present |
| 3 Domain | PASS | Provenance, UUIDs, matrix, versions, status and manifests |
| 4 Cost | PASS | Estimator, hard/soft limits, currency, routing and honest planning scope |
| 5 Token efficiency | PASS | Minimal fields, bounded prompts, versioned cache, structured batching and no real token usage |
| 6 Multi-brand isolation | PASS | Test 11 + context/assets/source checks |
| 7 Compliance | PASS | SafeZone REVIEW/BLOCK halts generation; internal policy only |
| 8 Review package | PASS | Nine required documents plus self-review; traceability §§0–83 |

Seven Skills pass repo-specific validation via `pnpm run validate:skills`. Bundled skill-creator quick_validate.py was attempted but cannot import PyYAML in this runtime. The replacement validates the two plain scalar frontmatter fields, names/descriptions, all nine required sections and absence of TODO scaffolds; it intentionally rejects richer YAML syntax.

Self-review corrections are in SELF_REVIEW.md. This report does not claim independent Claude review, real legal/platform approval, billed cost accuracy or media production validation.
