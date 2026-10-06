# Marketing OS v0.1

- Modular monolith: contracts/domain are independent of filesystem and providers. Agents decide; code controls IDs, expansion, validation, states and budgets.
- Build: `npm run build`; tests: `npm test`; CLI: `npm run generate -- --brand grand --product test-product --angles 3 --hooks 3 --visuals 2 --budget 5`. pnpm equivalents are supported.
- Done: 18 unique traceable variants, 18 valid manifests, QA/cost/efficiency reports, mandatory tests passing, complete review package.
- v0.1 only: no real AI/media, publishing, external accounts, cloud, queues, database, analytics or UI.
- No source → no claim. Fixtures must say TEST_FIXTURE and NOT_REAL_PRODUCT_DATA. Never invent brand/product facts.
- Faceless required. SafeZone defaults to REVIEW when regulatory information is absent; never bypass restrictions.
- Reuse → deterministic code → cache → cheap → standard → justified premium. Enforce hard budgets before paid work; report unknown metrics honestly.
- Never store/log credentials. Validate all boundaries; isolate brands, reject path traversal, preserve idempotency and version references.
