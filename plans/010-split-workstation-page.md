# Plan 010: Split the workstation page into focused components and hooks

> **Executor instructions**: This is a refactor plan. Preserve behavior exactly. Run verification after each extraction. If a STOP condition occurs, stop and report.
>
> **Drift check (run first)**: `git diff --stat fc9ae05..HEAD -- apps/web/app/page.tsx apps/web/lib/state.ts apps/web/tests/e2e/workstation.spec.ts`

## Status

- **Status**: DONE
- **Priority**: P2
- **Effort**: L
- **Risk**: MED, because the main UI file is a high-churn integration surface.
- **Depends on**: 007 and 009 are recommended first if they are being executed, because they change event/replay flows.
- **Category**: tech-debt, architecture
- **Planned at**: commit `fc9ae05`, 2026-06-23

## Why this matters

`apps/web/app/page.tsx` is 871 lines and is the highest-churn source file in the last 30 commits. It owns WebSocket lifecycle, upload behavior, simulator controls, layout, chat rendering, book rendering, event rendering, and small reusable UI helpers. That makes future UI fixes riskier than necessary and works against the repo goal: minimal, clean architecture, scalable and modular enough for a quant developer portfolio app. This should be a large dedicated split after plans 007 and 009 have frozen replay, clear-all, event validation, toast, and connection-pill behavior.

## Current state

- `git ls-files | xargs wc -l` shows `apps/web/app/page.tsx` at 871 lines, far larger than any other source file.
- Churn signal: `git log --name-only -30` shows `apps/web/app/page.tsx` changed 19 times.
- `page.tsx:76-90` owns the WebSocket effect.
- `page.tsx:143-160` owns replay upload.
- `page.tsx:175-403` owns the left sidebar.
- `page.tsx:405-436` owns the book grid.
- `page.tsx:438-483` owns the event panel.
- Local UI primitives already live in `apps/web/components/ui/`; domain-specific components should live under `apps/web/components/workstation/`.
- Resolved direction: use a workstation controller hook, explicit props, and high-level commands only. Do not introduce React context for this one-page app.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm --filter web typecheck` | exit 0 |
| Unit tests | `pnpm --filter web test` | all pass |
| E2E | `pnpm --filter web test:e2e` | all pass |

## Scope

**In scope**
- `apps/web/app/page.tsx`
- new files under `apps/web/components/workstation/` for domain-specific workstation pieces
- `apps/web/lib/use-workstation.ts` plus smaller hooks/helpers if the controller would otherwise become a monolith
- `apps/web/tests/*` only if imports need adjustment

**Out of scope**
- Do not change UI copy, layout, colors, event names, or backend API behavior.
- Do not add a state management library.
- Do not introduce React context/provider unless prop drilling becomes demonstrably worse than the context tradeoff.
- Do not move shadcn/Base UI primitives out of `components/ui`.
- Do not combine this with visual polish.
- Do not build custom UI primitives; compose existing shadcn/ui components with the project preset.

## Git workflow

- Branch: `codex/010-split-workstation-page`
- Commit message style: `web: split workstation components`

## Steps

### Step 1: Extract workstation domain components

Create focused files under `apps/web/components/workstation/`, for example:

- `left-sidebar.tsx`
- `chat-feed.tsx`
- `replay-upload.tsx`
- `simulator-controls.tsx`
- `book-panel.tsx`
- `event-panel.tsx`

Move existing rendering helpers into these files without changing behavior. Props should be explicit and typed with existing event/book types from `@/lib/events`.

**Verify**: `pnpm --filter web typecheck` exits 0.

### Step 2: Extract the workstation controller hook

Create `apps/web/lib/use-workstation.ts`. It should own reducer wiring, WebSocket lifecycle, replay upload, simulator commands, clear-all, connection/status state, and toast trigger plumbing.

Expose high-level commands only, for example:

- `submitUserMessage(text)`
- `uploadReplay(file)`
- `startSimulator(config)`
- `stopSimulator()`
- `clearAll()`

Do not expose low-level `dispatch` or `sendClientEvent` to visual components. If `use-workstation.ts` grows beyond roughly 250-300 lines, split smaller hooks rather than recreating a monolith.

**Verify**: `pnpm --filter web typecheck && pnpm --filter web test` exits 0.

### Step 3: Compose the route from explicit props

Reduce `apps/web/app/page.tsx` to route-level composition and layout. Target roughly 150-220 lines; under 250 is acceptable if explicit prop wiring is clearer.

Keep explicit props from the page into workstation components. Do not introduce context for this split.

**Verify**: `pnpm --filter web test:e2e --grep "side panels"` passes.

### Step 4: Check behavior stayed frozen

This is a refactor plan. No copy, layout, event semantics, replay semantics, clear-all behavior, or toast/status behavior should intentionally change.

**Verify**: `pnpm --filter web typecheck` exits 0 and E2E screenshots/DOM behavior show no layout drift.

### Step 5: Run full UI verification

Run the full frontend suite.

**Verify**: `pnpm --filter web test && pnpm --filter web test:e2e` exits 0.

## Test plan

No new behavior tests are required for this pure refactor. Existing E2E tests are the characterization suite. If any behavior changes are necessary, stop and split that into a separate plan.

## Done criteria

- [ ] `apps/web/app/page.tsx` is reduced to orchestration/layout composition, ideally under ~150-220 lines and under 250 unless clarity requires otherwise.
- [ ] Domain components live under `apps/web/components/workstation/` and UI primitives remain under `apps/web/components/ui/`.
- [ ] `apps/web/lib/use-workstation.ts` exposes high-level commands only.
- [ ] Explicit props are used; no React context/provider is introduced.
- [ ] No visual or behavioral changes are intentional.
- [ ] `pnpm --filter web typecheck`, `pnpm --filter web test`, and `pnpm --filter web test:e2e` pass.

## STOP conditions

- Refactor requires backend/API changes.
- E2E screenshots or DOM snapshots show layout drift.
- The extraction creates generic abstractions that obscure domain names like broker input, book, or parsed events.
- `use-workstation.ts` becomes a new oversized monolith instead of a controller hook with narrow helpers.

## Maintenance notes

After this lands, future UI work should touch narrow component files instead of the app route whenever possible.
