# Plan 010: Split the workstation page into focused components and hooks

> **Executor instructions**: This is a refactor plan. Preserve behavior exactly. Run verification after each extraction. If a STOP condition occurs, stop and report.
>
> **Drift check (run first)**: `git diff --stat fc9ae05..HEAD -- apps/web/app/page.tsx apps/web/lib/state.ts apps/web/tests/e2e/workstation.spec.ts`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED, because the main UI file is a high-churn integration surface.
- **Depends on**: 007 and 009 are recommended first if they are being executed, because they change event/replay flows.
- **Category**: tech-debt, architecture
- **Planned at**: commit `fc9ae05`, 2026-06-23

## Why this matters

`apps/web/app/page.tsx` is 871 lines and is the highest-churn source file in the last 30 commits. It owns WebSocket lifecycle, upload behavior, simulator controls, layout, chat rendering, book rendering, event rendering, and small reusable UI helpers. That makes future UI fixes riskier than necessary and works against the repo goal: minimal, clean architecture, scalable and modular enough for a quant developer portfolio app.

## Current state

- `git ls-files | xargs wc -l` shows `apps/web/app/page.tsx` at 871 lines, far larger than any other source file.
- Churn signal: `git log --name-only -30` shows `apps/web/app/page.tsx` changed 19 times.
- `page.tsx:76-90` owns the WebSocket effect.
- `page.tsx:143-160` owns replay upload.
- `page.tsx:175-403` owns the left sidebar.
- `page.tsx:405-436` owns the book grid.
- `page.tsx:438-483` owns the event panel.
- Local UI primitives already live in `apps/web/components/ui/`; domain-specific components can live under `apps/web/components/`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm --filter web typecheck` | exit 0 |
| Unit tests | `pnpm --filter web test` | all pass |
| E2E | `pnpm --filter web test:e2e` | all pass |

## Scope

**In scope**
- `apps/web/app/page.tsx`
- new files under `apps/web/components/` for domain-specific workstation pieces
- new files under `apps/web/lib/` for hooks/helpers if needed
- `apps/web/tests/*` only if imports need adjustment

**Out of scope**
- Do not change UI copy, layout, colors, event names, or backend API behavior.
- Do not add a state management library.
- Do not move shadcn/Base UI primitives out of `components/ui`.
- Do not combine this with visual polish.

## Git workflow

- Branch: `codex/010-split-workstation-page`
- Commit message style: `web: split workstation components`

## Steps

### Step 1: Extract pure book components

Move `BookEmptyState`, `BookCardSkeleton`, `BookSideColumn`, and `BookQuoteRow` into a new domain component file, for example `apps/web/components/book-panel.tsx`.

Props should be explicit and typed with existing `BookRow`/book payload types from `@/lib/events`.

**Verify**: `pnpm --filter web typecheck` exits 0.

### Step 2: Extract side panel primitives and chat rows

Move `PanelHeader`, `SidebarIndicator`, `RightEdgeIndicator`, `SidebarSection`, `SectionHeading`, `FieldTooltip`, `ConnectPlaceholder`, `EmptyWithSkeleton`, and chat row rendering into one or two focused files under `apps/web/components/`.

Do not create a generic abstraction for everything. Keep names domain-specific where the component is domain-specific.

**Verify**: `pnpm --filter web typecheck && pnpm --filter web test` exits 0.

### Step 3: Extract simulator controls

Move `SIMULATOR_HELP` and `NumberStepper` plus the simulator controls block into `apps/web/components/simulator-controls.tsx`. Its props should be values, setters, running state, connection state, and the toggle handler.

Keep the existing vertically stacked plus/minus design and tooltips.

**Verify**: `pnpm --filter web test:e2e --grep "side panels"` passes.

### Step 4: Extract WebSocket/replay behavior only if it stays small

If `page.tsx` is still above roughly 300 lines, extract the WebSocket effect and client event sender into a hook such as `apps/web/lib/use-workstation-stream.ts`. Do not over-abstract: the hook may simply return `{ state, dispatch, isConnected, sendClientEvent }`.

**Verify**: `pnpm --filter web typecheck` exits 0.

### Step 5: Run full UI verification

Run the full frontend suite.

**Verify**: `pnpm --filter web test && pnpm --filter web test:e2e` exits 0.

## Test plan

No new behavior tests are required for this pure refactor. Existing E2E tests are the characterization suite. If any behavior changes are necessary, stop and split that into a separate plan.

## Done criteria

- [ ] `apps/web/app/page.tsx` is reduced to orchestration/layout composition, ideally under ~300 lines.
- [ ] Domain components live under `apps/web/components/` and UI primitives remain under `apps/web/components/ui/`.
- [ ] No visual or behavioral changes are intentional.
- [ ] `pnpm --filter web typecheck`, `pnpm --filter web test`, and `pnpm --filter web test:e2e` pass.

## STOP conditions

- Refactor requires backend/API changes.
- E2E screenshots or DOM snapshots show layout drift.
- The extraction creates generic abstractions that obscure domain names like broker input, book, or parsed events.

## Maintenance notes

After this lands, future UI work should touch narrow component files instead of the app route whenever possible.
