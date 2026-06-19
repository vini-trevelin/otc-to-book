# Plan 004: Verify V1 And Polish README

> Executor instructions: Follow this plan step by step. Run every verification command and confirm expected result before moving on. If any STOP condition occurs, stop and report.
>
> Drift check: `git diff --stat HEAD -- README.md docs tasks plans apps data`
> If there is no commit yet, compare live files against this plan and docs manually before editing.

## Status

- Priority: P1
- Effort: M
- Risk: LOW
- Depends on: `plans/001-repo-docs-and-tooling.md`, `plans/002-api-domain-pipeline.md`, `plans/003-web-realtime-workstation.md`
- Category: docs/tests
- Planned at: no commits yet, 2026-06-19

## Why This Matters

V1 is not done until the full flow is verified and the public repo explains what it does cleanly. This plan turns implementation into a demonstrable portfolio artifact without bloating README with internal planning detail.

## Current State

Expected after dependencies:

- Monorepo scaffold exists.
- Backend tests pass.
- Frontend tests and E2E pass.
- Workstation can run locally.
- README still contains concise objective and doc links.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install all | `pnpm install` | exit 0 |
| API sync | `cd apps/api && uv sync` | exit 0 |
| All lint | `pnpm lint` | exit 0 |
| All typecheck | `pnpm typecheck` | exit 0 |
| All tests | `pnpm test` | all pass |
| API tests | `cd apps/api && uv run pytest` | all pass |
| Version guard | `node scripts/check-exact-versions.mjs` | exit 0 |
| E2E | `pnpm --filter web test:e2e` | all pass |

## Scope

In scope:

- `README.md`
- `docs/`
- `tasks/`
- `plans/`
- demo media placeholders or generated screenshots if available.
- minor test/docs fixes needed to make verification reproducible.

Out of scope:

- New product features.
- Parser expansion beyond V1 templates.
- UI redesign.
- Production deployment.

## Git Workflow

- Keep current branch unless instructed.
- Do not push or open PR unless instructed.

## Steps

### Step 1: Run Full Verification

Run all commands listed above.

Capture failures exactly. Fix only issues within V1 scope. If a failure indicates missing behavior from an earlier plan, update the relevant plan status to BLOCKED and report.

Verify:

```sh
pnpm lint && pnpm typecheck && pnpm test && node scripts/check-exact-versions.mjs
```

Expected: all exit 0.

### Step 2: Verify Runtime Flow

Start dev environment:

```sh
pnpm dev
```

Manually or via E2E, verify:

- Open app.
- WebSocket connects.
- Send `vendo petro27 7.30 5mm`.
- Chat shows message.
- Event panel shows parsed/accepted event.
- Book shows PETRO27 ask.
- Send replacement ask from same broker.
- Old ask row becomes stale/muted.
- Inspect event detail: sequence increases, schema version is `1`, correlation ID links message-derived events.

Verify:

```sh
pnpm --filter web test:e2e
```

Expected: all E2E tests pass.

### Step 3: Add README Demo Section

Update `README.md` to include:

- Objective.
- Quickstart.
- V1 feature list.
- Demo GIF/video placeholder or actual path.
- Links to docs.

Keep README concise. Do not paste long architecture design; link to `docs/architecture.md`.

Verify:

```sh
python3 - <<'PY'
from pathlib import Path
text = Path('README.md').read_text()
assert 'OTC-to-Book' in text
assert 'Quickstart' in text
assert 'docs/architecture.md' in text
print('README ok')
PY
```

Expected: `README ok`.

### Step 4: Finalize Docs Status

Update:

- `tasks/todo.md`
- `plans/README.md`
- any plan status rows.
- `tasks/lessons.md` if user corrections occurred during implementation.

Verify:

```sh
rg "BLOCKED|TODO|IN PROGRESS" tasks plans
```

Expected: only intentional future/open statuses remain.

## Test Plan

No new feature tests unless verification finds a gap. If a bug is found, add a regression test in the relevant app before fixing.

## Done Criteria

- [ ] Full lint/typecheck/test suite passes.
- [ ] API tests pass.
- [ ] E2E tests pass.
- [ ] Version guard passes.
- [ ] Event contract tests pass.
- [ ] Sample fixture expected-output tests pass.
- [ ] Local runtime flow verified.
- [ ] README is concise and public-facing.
- [ ] Docs link to architecture/domain/tooling detail.
- [ ] `tasks/todo.md` and `plans/README.md` mark all V1 plans DONE.

## STOP Conditions

Stop and report if:

- Any full-suite verification fails twice after scoped fix attempts.
- Runtime flow cannot be verified locally.
- Fix requires adding future-phase behavior.
- README changes drift into long internal architecture notes.

## Maintenance Notes

Reviewer should focus on evidence: command outputs, E2E coverage, dependency pin guard, and whether README accurately reflects implemented V1.
