# Task Orchestrator

Status values: TODO | IN PROGRESS | DONE | BLOCKED.

## Current Status

V1 implementation is complete and verified.

Completed work:

- Monorepo scaffold, exact pinning, sample fixtures, lockfiles, and baseline checks.
- Backend domain pipeline, simulator, API, event contracts, and tests.
- Realtime workstation UI, WebSocket state, unit tests, and E2E flows.
- Full verification, README quickstart/features, and current docs.

## Next Planning Gate

Create new task plans only when the architect opens the next implementation iteration. New plans should be checkable, scoped, and linked from this file while active.

## Active Plan: UI Fixes And Impeccable Polish

Status: IN PROGRESS

- [x] Create branch for UI fixes.
- [x] Initialize design context artifacts under `docs/`.
- [x] Confirm key shell decisions with architect.
- [x] Implement collapsible left/right sidebars and center book layout changes.
- [x] Polish scrollbars, sidebar spacing, book card metadata, timestamps, and Next marker removal.
- [x] Verify with browser, E2E, lint, typecheck, and relevant tests.
- [x] Apply accepted critique follow-up: empty state, tooltip affordance, recovery copy, and left-rail weight.
- [x] Verify accepted critique follow-up with typecheck, tests, E2E, and browser inspection.
- [x] Replace placeholder surfaces with shadcn-style skeleton placeholders.
- [x] Rerun Impeccable critique after skeleton pass and persist docs/snapshot artifacts.

Review/results:

- Branch: `codex/ui-fixes-polish`.
- Design context lives in `docs/PRODUCT.md` and `docs/DESIGN.md` per architect direction.
- Left sidebar defaults visible and collapsible; right sidebar defaults hidden behind a compact indicator.
- Book cards render in a responsive auto-fit grid, omit the center container title, and use 24-hour timestamps.
- Accepted critique follow-up kept right sidebar behavior and mobile ordering unchanged, while adding an operational book empty state, subtle title-tooltip affordance, actionable replay/stream recovery copy, and a quieter left rail.
- Placeholder surfaces now use `Skeleton` under `apps/web/components/ui/skeleton.tsx`; empty book, empty chat, empty event feed, and Connect future placeholder use skeleton previews.
- Impeccable critique trend improved from 26 to 30 after the accepted follow-up and skeleton pass.
- Verification passed: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm --filter web test:e2e`, `pnpm check:versions`, and browser overlay/console check.
- Follow-up verification passed: `pnpm --filter web typecheck`, `pnpm --filter web test`, `pnpm --filter web test:e2e`, and browser screenshot/no-horizontal-overflow check.

## Working Agreements

- User is architect.
- Agent must not silently expand scope.
- All version pins exact.
- Business logic stays backend/domain.
- Tests required for changed logic.
