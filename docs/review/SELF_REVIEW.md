# Self-review

Reviewed after the full tests and CLI demo. Independent reviewer has not been invoked; this package prepares that separate review.

| Question | Evidence / result |
|---|---|
| AI where code suffices? | None. Matrix, IDs, strategy templates, QA, states and metrics use code. |
| Unnecessary context or duplicate prompts? | ContextBuilder allowlists; one PromptRegistry; test 18/19. |
| Cache opportunity? | Versioned memory/filesystem cache implemented and tested; deterministic CLI needs no AI cache calls. |
| Duplicate operation or regenerated asset? | Key lock + atomic snapshot + replay; semantic dedup; template reuse. No media regeneration. |
| Premium by default? | TEMPLATE CLI and CHEAP-first ModelRouter; explicit premium justification/budget tests. |
| LLM controls critical state? | No LLM adapter; transition and budget are deterministic. |
| Fact without provenance? | Exact fact/source/hash/ownership checks; template reconstruction catches arbitrary text changes. |
| Brand data leakage? | Brand/product directories and IDs; context/assets/source ownership; test 11. |
| Hardcoded current prices? | No live prices. TEST_FIXTURE prices exist only in tests. |
| IDs/versions missing? | Batch/creative/hypothesis/experiment/task/usage IDs and config/source/prompt/template versions preserved. |
| Untraceable cost or invented metrics? | Planning scope explicit; empty real usage ledger; future amounts unavailable; savings need baseline. |
| Premature abstraction/dependencies? | Seven required provider ports; repositories; one runtime validation dependency. No services/queues/cloud. |

Corrections from review:

- pnpm can forward `--`; CLI accepts that separator and npm-style arguments. Verified with actual source CLI.
- Withheld compliance no longer constructs creative hypotheses before discarding them; it constructs an empty strategy record only.
- Filesystem output hashes are checked on replay; modifying a manifest rejects the persisted batch rather than trusting stale QA.
- Ambiguous matrix decision IDs fail explicitly, while equivalent aliases deduplicate. QA cannot PASS an empty/truncated allowed matrix.
- Routing filters currency; token aggregation does not count reasoning or cached tokens twice. AIUsageRecord validates those subsets.
- Budget decisions compare the unrounded projected spend to avoid hiding small hard-limit overruns; provider ports explicitly receive the versioned prompt/schema.
- Model candidates must match provider/model identities in their pricing record; AI batch ceilings reject non-finite limits.

Remaining tradeoffs/risks are described in KNOWN_LIMITATIONS.md. No extra product phase was implemented.
