# Task Orchestrator

Status values: TODO | IN PROGRESS | DONE | BLOCKED.

## Current Status

V1 implementation, UI polish, and extractor evaluation are complete and merged to `main`.

Active implementation branch: `feat/fuzzy_extraction_implementation`.

Completed work:

- Monorepo scaffold, exact pinning, sample fixtures, lockfiles, and baseline checks.
- Backend domain pipeline, simulator, API, event contracts, and tests.
- Realtime workstation UI, WebSocket state, unit tests, and E2E flows.
- Full verification and current docs.
- UI polish branch: collapsible sidebars, book-first layout, compact book rows, 24-hour times, static muted placeholders, fixed-height chat feed, and shadcn-style title tooltips/skeletons.
- Extractor evaluation branch: session-scoped valid ticker pool, explicit ticker aliases, extraction metrics, fixture rows, and backend-owned future provider docs.
- Fuzzy extraction branch: chaotic fixture categories, false-merge metrics, simulator chaos controls, and bounded session-pool fuzzy ticker resolution.

## Active Plans

- `plans/005-chaotic-extraction-evaluation-and-simulator.md` - DONE.
- `plans/006-bounded-fuzzy-ticker-resolver.md` - DONE.

## Review Results

- Current extractor evaluation reports `exact_row=27/27` and `false_merge=3/3`.
- Fuzzy matching is local and deterministic: aliases first, exact pool hit second, then bounded one-edit/adjacent-transposition match against the session pool only.
- Frontend chaos controls are exposed as simulator inputs only; backend remains the owner of generated messages and extraction behavior.

## Working Agreements

- User is architect.
- Agent must not silently expand scope.
- All version pins exact.
- Business logic stays backend/domain.
- Tests required for changed logic.
