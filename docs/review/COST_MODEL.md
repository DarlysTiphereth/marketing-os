# Cost model and review

**PASS for v0.1:** no paid task is executed; CostRouter sends each manifest-planning task to deterministic code. Existing planning templates are reused. No provider credentials or current provider prices are present.

- CostRouter: REUSE → CODE → CACHE → CHEAP → STANDARD → justified PREMIUM, with a budget decision first.
- BudgetPolicy: scopes GLOBAL/BRAND/PRODUCT/CAMPAIGN/EXPERIMENT, period, currency, soft/hard limits, warning threshold and premium permission. CLI uses a PRODUCT/BATCH policy with soft limit and warning threshold at 80% of the requested hard limit; no other scopes are configured/enforced by the CLI yet.
- Hard limit: `actual_spend + estimate > hard_limit` blocks explicitly. Equality is allowed. Soft limit triggers WARN, reuse/cache/cheap preference and disables premium. Non-finite/negative amounts and currency mismatches fail.
- CostEstimator: `(uncached_input * input_unit_price + cached_input * cached_input_unit_price + output * output_unit_price) / token_unit + media_units * media_unit_price`. Inputs are nonnegative; cached is a subset of input. Planning reports aggregate categories; no future fee is presumed zero.
- ProviderPricing: immutable version selected explicitly via repository, effective timestamp, currency, units and source_reference. The repo has no live catalog. Unit-test prices are TEST_FIXTURE / NOT_REAL_PRICING and never feed CLI reports.
- AIUsageLedger: per-call UUID, task/creative/brand/product IDs, tier, prompt/skill versions, latency, tokens, estimated/actual amounts, cache and batching flags. Duplicate usage IDs are rejected. The batch ledger is empty for this release.
- CreativeVariant and ProductionManifest carry the seven cost categories and total. All are zero for current planning. Media adapters must estimate their full operation before any provider side effect and reconcile billing afterward.

Demo: estimated planning cost **BRL 0**, budget **BRL 5**, remaining **BRL 5**, status **OK**. `actual_total_if_available` and `future_media_cost` are NOT_AVAILABLE_YET. This is provider/media cost, excluding engineering time, hardware and electricity.

No counterfactual baseline exists: savings from cache/reuse/dedup/routing/code are NOT_CALCULABLE_YET. ROAS/ROI and downstream business metrics are contracts only.
