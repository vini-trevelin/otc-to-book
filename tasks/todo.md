# Task Orchestrator

Status values: TODO | IN PROGRESS | DONE | BLOCKED.

## Current Status

V1 implementation, UI polish, and extractor evaluation are complete and merged to `main`.

Active planning branch: `feat/fuzzy_extraction_implementation`.

Completed work:

- Monorepo scaffold, exact pinning, sample fixtures, lockfiles, and baseline checks.
- Backend domain pipeline, simulator, API, event contracts, and tests.
- Realtime workstation UI, WebSocket state, unit tests, and E2E flows.
- Full verification and current docs.
- UI polish branch: collapsible sidebars, book-first layout, compact book rows, 24-hour times, static muted placeholders, fixed-height chat feed, and shadcn-style title tooltips/skeletons.
- Extractor evaluation branch: session-scoped valid ticker pool, explicit ticker aliases, extraction metrics, fixture rows, and backend-owned future provider docs.

## Active Plans

- `plans/005-chaotic-extraction-evaluation-and-simulator.md` - add chaotic fixtures, false-merge metrics, and simulator chaos controls before fuzzy matching.
- `plans/006-bounded-fuzzy-ticker-resolver.md` - implement conservative session-pool fuzzy ticker resolution after plan 005.

## Working Agreements

- User is architect.
- Agent must not silently expand scope.
- All version pins exact.
- Business logic stays backend/domain.
- Tests required for changed logic.
