# Token architecture and review

**PASS for v0.1:** zero LLM tasks and zero provider tokens consumed. No strategy/provider simulation runs inside the CLI. Fixed fixture strategy uses code; semantic dedup avoids duplicate planning work.

- ContextBuilder uses explicit MINIMAL/PRODUCT/CREATIVE/COMPLIANCE/ANALYTICS field allowlists. Minimal context contains IDs/versions/name/official description/data label and excludes full brand brain, sources, assets, warnings and timestamps.
- PromptRegistry centralizes instructions, schema and immutable version. Prompt budgets are classification 64, hook 128, caption 192, script 768, strategy 1024, deep analysis 2048 output tokens. These are initial configuration limits, not measured usage.
- enforceOutputBudget checks `min(task limit, prompt limit)` and task type. A future provider adapter must pass the cap to the provider, validate structured results and reconcile reported usage.
- VersionedCache keys include task, normalized input hash, brand/product IDs and versions, prompt/skill versions and model family. Key-order normalization is canonical JSON; arbitrary semantic text normalization is not attempted. Filesystem and memory adapters are tested. Version changes miss cache.
- prepareBatch requires same task type and brand/product, batching opt-in, BATCH latency, unique UUIDs and a bounded output envelope. Twenty hook tasks produce a 2688-token configured ceiling, including 128 envelope tokens. Result validation preserves every task ID and rejects missing/duplicate/unknown IDs or invalid schema.
- CheapFirstModelRouter attempts cheap before standard; premium requires both cheaper tiers to have failed quality checks, explicit justification and allowed budget. Candidate prices are injected, context/cost/currency limits enforced. No real model catalog is provided.
- AIUsageRecord distinguishes SIMULATED fixtures. Cached tokens are a subset of input; reasoning tokens must be normalized by future adapters as a subset of output and are not added twice. TokenMetrics prepares per-task/creative/brand/product counts and averages.

CLI measurements: input 0, output 0, cached 0; cache hits 0, misses 0 because no AI lookup was attempted. Cache hit rate and premium model rate are unavailable due to zero denominator. Media tier rates count planned manifests, not rendered assets.
