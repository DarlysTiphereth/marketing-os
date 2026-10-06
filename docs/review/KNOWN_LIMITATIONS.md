# Known limitations and technical debt

1. All brand/product knowledge is synthetic configuration/evidence, marked TEST_FIXTURE and NOT_REAL_PRODUCT_DATA. No real GRAND benefits, tone, audience or usage instructions are asserted.
2. Strategy is a fixed factual planning template. Three angles × three hooks × two executions are the supported maximum. It does not demonstrate creative performance, persuasion or factual real-world product quality.
3. No LLM/media/provider, real pricing catalog, paid execution, publishing, analytics, UI, queue, n8n or PostgreSQL. Interfaces are prepared only. CLI accepts TEMPLATE; HYBRID/PREMIUM require future priced adapters.
4. READY_FOR_PRODUCTION is a planning status. The reusable asset is JSON planning metadata. Product photography, media ownership, branding, render output and actual face detection must be checked when real media exists.
5. Compliance uses internal conservative rules, not a complete/current legal or platform policy database. SafeZone unknown categories remain REVIEW, restricted categories BLOCK. No path can promote REVIEW/BLOCK to READY in this slice. Pre-publication enforcement is a future requirement.
6. Cost estimates cover v0.1 planning only. Future media cost, actual billing, ROI/ROAS and savings without baselines are unavailable. BRL is a configurable test default; no exchange rates are inferred.
7. Cache, AI batching, model fallback and usage ledger are executable local modules tested with clearly synthetic values. The deterministic CLI does not perform AI requests or AI cache lookups; rates with zero denominator are null/unavailable.
8. Asset usage_count is a per-batch snapshot starting from catalog count. It is persisted and inspected within the batch; global cumulative usage across independent batches is not materialized. assets_reused counts references, not distinct templates (18 references to one template).
9. Idempotency scans finalized output directories: O(number of batches). The lock retries for 5 seconds; a crashed process can leave a lock. Inspect the interrupted run and remove only its stale lock manually. No automatic stale-lock deletion, retries, timeouts or disaster recovery is implemented.
10. Atomic rename assumes one local filesystem. No fsync durability guarantee, distributed locking or arbitrary network-drive semantics. Filesystem boundaries reject traversal and existing escaping symlinks, but do not promise protection against a hostile process racing path checks.
11. Integrity checks are unsigned local hashes. Local administrators can modify data and hashes; batches are not tamperproof. Replay returns the original snapshot without reloading current inputs. New versions require a new idempotency key.
12. Provenance currently consumes local JSON evidence envelopes with exact fact membership. Authenticity of official/manual evidence must be established by the human supplying it. Remote ingestion/OCR requires a future adapter.
13. Deterministic QA rejects any changed template content; arbitrary AI copy will need an explicit structured claim-validation path. Facts missing for real production must keep knowledge_status INCOMPLETE, causing REVIEW.
14. npm is unavailable in this execution host. pnpm and direct Node commands are verified. Package scripts support npm where installed; pnpm frozen lockfile is the reproducible installation path.

These are deliberate v0.1 bounds or concrete future work, not reasons to add infrastructure now. No independent review has been performed yet.
