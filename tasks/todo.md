# Task Orchestrator

Status values: TODO | IN PROGRESS | DONE | BLOCKED.

## Current Status

V1 implementation, UI polish, and extractor evaluation are complete and merged to `main`.

Active implementation branch: `main`.

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
- Current UI iteration - DONE:
  - Add simulator control tooltips for Random, Noise, Step, Chaos, Ticker typo, and Template noise.
  - Redesign simulator numeric steppers with vertically stacked increment/decrement controls.
  - Make the left chat feed consume remaining sidebar height without causing page overflow.
  - Add a left-sidebar Clear all books control that clears backend book rows while preserving chat/event provenance.

## Current UI Iteration Plan

Acceptance:

- Hovering or focusing each simulator variable label exposes a concise tooltip explaining the backend simulator parameter.
- Numeric simulator controls keep the current compact sidebar density while stacking plus/minus controls vertically beside each input.
- The left chat feed fills available sidebar height and scrolls internally with no page-level overflow on the workstation viewport.
- Clear all books appears under the left sidebar content and clears backend book rows without clearing chat messages or parsed events.
- API, reducer, and E2E tests cover the clear-books flow.

Results:

- Implemented simulator control tooltips with existing Base UI/shadcn-style tooltip primitives.
- Implemented compact vertical plus/minus controls beside simulator numeric inputs.
- Updated the left sidebar to use viewport-bounded layout with an internally scrolling chat feed.
- Added backend-owned `book_clear` handling and a left-sidebar Clear all books control.
- Verified with frontend typecheck/unit tests, targeted API tests, E2E tests, and live browser smoke checks.

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
