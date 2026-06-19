# Plan 003: Build Realtime Workstation UI

> Executor instructions: Follow this plan step by step. Run every verification command and confirm expected result before moving on. If any STOP condition occurs, stop and report.
>
> Drift check: `git diff --stat HEAD -- apps/web apps/api/src/otc_to_book/api docs/frontend.md docs/architecture.md`
> If there is no commit yet, compare live files against this plan and docs manually before editing.

## Status

- Priority: P1
- Effort: L
- Risk: MED
- Depends on: `plans/001-repo-docs-and-tooling.md`, `plans/002-api-domain-pipeline.md`
- Category: feature/tests
- Planned at: no commits yet, 2026-06-19

## Why This Matters

The UI is the visible product: a simplified OTC trading workstation. It must prove the event pipeline by rendering chat, parsed quote events, rejected messages, and book state in real time. Business rules must remain backend-owned.

## Current State

Expected after dependencies:

- `apps/web` exists.
- Backend WebSocket contract and event envelope exist.
- Backend tests pass.
- `docs/frontend.md` defines the layout and UI states.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install web deps | `pnpm install` | exit 0 |
| Dev server | `pnpm dev` | starts API and web via turbo |
| Web lint | `pnpm --filter web lint` | exit 0 |
| Web typecheck | `pnpm --filter web typecheck` | exit 0 |
| Web tests | `pnpm --filter web test` | all pass |
| E2E | `pnpm --filter web test:e2e` | all pass |

Command names may be adjusted to match Plan 001 scripts, but must be documented in `docs/tooling.md`.

## Scope

In scope:

- `apps/web/app/`
- `apps/web/components/`
- `apps/web/lib/`
- `apps/web/tests/`
- `apps/web/package.json`
- shadcn/ui generated files required for V1.
- Web-facing type definitions that mirror backend events.

Out of scope:

- Backend domain behavior changes unless API contract bug blocks UI.
- LLM/extraction logic.
- Persistence.
- Auth.
- Marketing homepage.

## Git Workflow

- Keep current branch unless instructed.
- Do not push or open PR unless instructed.

## Steps

### Step 1: Initialize Next.js With Exact Pins

Initialize `apps/web` as a Next.js TypeScript app compatible with Tailwind and shadcn/ui.

Use the requested shadcn preset:

```sh
npx shadcn@<exact-version> init --preset b5de05qQC --template next --monorepo --pointer
```

Before running, determine exact `shadcn` version. After generation, remove any floating dependency ranges.

Verify:

```sh
node scripts/check-exact-versions.mjs
```

Expected: exit 0.

### Step 2: Define WebSocket Client Types

Create `apps/web/lib/events.ts`.

Define TypeScript event types matching backend payloads:

- client events: `user_message`, `simulator_start`, `simulator_stop`.
- server events: `message_received`, `quote_parsed`, `quote_rejected`, `quote_event`, `book_updated`.
- common envelope fields: `event_id`, `event_type`, `schema_version`, `sequence`, `session_id`, `correlation_id`, `occurred_at`, `payload`.

Do not invent frontend-only domain semantics.

Verify:

```sh
pnpm --filter web typecheck
```

Expected: exit 0.

### Step 3: Build Workstation Layout

Create first screen as the working app:

- left chat panel.
- center book panel.
- right parsed event panel.

No marketing hero.

Use dense trading-tool styling:

- readable tables.
- clear status chips.
- muted stale rows.
- timestamps and age display.

Verify:

```sh
pnpm --filter web lint
```

Expected: exit 0.

### Step 4: Implement Chat Controls

User mode:

- text input.
- send button.
- broker selector/default.

Auto mode:

- start/stop.
- randomness slider 1 to 5.
- noise rate control.
- interval control.

Replay:

- JSON/CSV upload to backend endpoint.
- display upload errors.

Verify:

```sh
pnpm --filter web test
```

Expected: tests for controls pass.

### Step 5: Implement Real-Time State Handling

Connect to backend WebSocket.

Required UI states:

- connecting.
- connected.
- disconnected/retry.
- simulator running/stopped.
- empty book.
- rejected/noise messages.

Use backend event payloads to update UI. Do not calculate best bid/ask in frontend if backend sends book state.

Use `sequence` to apply events in order. Ignore duplicate `event_id` values if seen after reconnect/retry. Preserve `correlation_id` in event detail/debug views.

Verify:

```sh
pnpm --filter web test
```

Expected: state reducer/hook tests pass.

### Step 6: Add E2E Tests

Add Playwright tests:

- user sends `vendo petro27 7.30 5mm`; chat + event + book update visible.
- same broker sends updated ask; old row muted stale, new row active.
- auto simulator starts and produces events.
- sample replay upload path works with fixture.
- duplicate event ID does not duplicate a row.
- out-of-order lower sequence event is ignored or safely handled according to reducer tests.

Verify:

```sh
pnpm --filter web test:e2e
```

Expected: all pass.

## Test Plan

Use:

- unit/component tests for controls and reducers.
- Playwright for complete user flows.
- real backend dev server for E2E when feasible.

Do not rely only on screenshots or visual inspection.

## Done Criteria

- [ ] First viewport is working workstation, not marketing page.
- [ ] WebSocket connection state visible.
- [ ] Event reducer respects envelope sequence and event ID dedupe.
- [ ] User mode works end to end.
- [ ] Auto controls emit backend events.
- [ ] Sample replay upload handles success/error.
- [ ] Active/stale rows are visually distinct.
- [ ] Timestamps/age visible in book.
- [ ] `pnpm --filter web lint` passes.
- [ ] `pnpm --filter web typecheck` passes.
- [ ] `pnpm --filter web test` passes.
- [ ] `pnpm --filter web test:e2e` passes.
- [ ] `tasks/todo.md` and `plans/README.md` mark Plan 003 DONE.

## STOP Conditions

Stop and report if:

- Backend WebSocket contract is missing or unstable.
- shadcn preset cannot be installed with exact pins.
- E2E requires changing backend domain semantics.
- UI implementation starts duplicating book-builder business logic.

## Maintenance Notes

Reviewer should inspect whether frontend is a renderer/control surface only. Watch for accidental domain rules in React state and for missing disconnected/error states.
