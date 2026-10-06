# Foundation v0.1 execution plan

## Discovery
Empty Git repository; no existing application or instructions. Node 24.19.0 and pnpm 11.25.0 available; npm is absent from PATH. No real brand/product evidence provided. No provider calls, current pricing research or regulatory scraping are needed because there are no paid operations or legal permissions asserted.

## Plan
1. Contracts: strict Zod schemas and provider/repository ports, including future-only interfaces.
2. Domain: provenance, state transitions, matrix expansion, asset reuse, deterministic strategy and manifests.
3. Implementation: compliance, cost/token controls, atomic filesystem adapter and CLI.
4. Tests: all 31 mandatory cases plus meaningful boundary/concurrency/QA checks.
5. Cost review: zero execution cost for code; future media cost is unknown, premium is exceptional, hard/soft limits tested.
6. Token review: no LLM tokens consumed; selected context only, versioned cache/prompts, bounded structured batching.
7. Self-review: correctness, provenance, isolation, malformed input, persistence races, observability and scope.
8. Review package and final report; stop at v0.1.

## Choices
TypeScript + Zod + built-in node:test avoids an extra test framework. pnpm installs dependencies; package scripts remain npm-compatible. Fixture data is synthetic, not GRAND business information. READY_FOR_PRODUCTION means planning passed, not media generated or approved to publish. Filesystem output is the repository state; repositories expose replaceable ports.
