# Plan 008: Add a minimal CI verification baseline

> **Executor instructions**: Follow this plan step by step. Run every verification command. If a STOP condition occurs, stop and report.
>
> **Drift check (run first)**: `git diff --stat fc9ae05..HEAD -- package.json turbo.json apps/web/package.json apps/api/pyproject.toml .github`

## Status

- **Status**: DONE
- **Priority**: P1
- **Effort**: M
- **Risk**: LOW, mostly tooling and workflow configuration.
- **Depends on**: none
- **Category**: dx, tests, security
- **Planned at**: commit `fc9ae05`, 2026-06-23

## Why this matters

This is a quant developer portfolio app. The local verification story is strong, but there is no tracked `.github` workflow and root `pnpm test` does not run Playwright E2E. Direct pushes to `main` can therefore bypass the most important UI integration checks. `pnpm audit --prod` also reports a moderate PostCSS advisory through `apps__web>next>postcss`, and Python dependency audit tooling is absent (`uv run pip-audit` fails because the command is not installed). CI should stay minimal: one workflow on pull requests and pushes to `main`, with a fast verification job and a separate E2E job that depends on it.

## Current state

- No `.github` directory exists.
- Root scripts in `package.json:6-12` include `check:versions`, `lint`, `test`, and `typecheck`.
- E2E exists only as `apps/web/package.json:9` script `test:e2e`.
- `docs/tooling.md:55-66` lists `pnpm --filter web test:e2e` separately from `pnpm test`.
- `pnpm audit --prod` currently reports one moderate advisory: PostCSS `<8.5.10` via `apps__web>next>postcss`.
- `cd apps/api && uv run pip-audit` currently fails with "No such file or directory".

Relevant excerpts:

```json
// package.json:6-12
"scripts": {
  "check:versions": "node scripts/check-exact-versions.mjs",
  "dev": "turbo dev",
  "lint": "turbo lint",
  "test": "turbo test",
  "typecheck": "turbo typecheck"
}
```

```json
// apps/web/package.json:5-10
"scripts": {
  "dev": "next dev",
  "lint": "tsc --noEmit",
  "test": "vitest run",
  "test:e2e": "playwright test",
  "typecheck": "tsc --noEmit"
}
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Exact versions | `pnpm check:versions` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Unit/API tests | `pnpm test` | exit 0 |
| E2E | `pnpm --filter web test:e2e` | exit 0 |
| Extraction metrics | `cd apps/api && uv run python scripts/evaluate_extraction.py` | exact row and false merge metrics stay 100% |
| JS audit | `pnpm audit --prod --audit-level high` | exit 0 |

## Scope

**In scope**
- `.github/workflows/ci.yml` (new)
- `package.json` only if adding a root `test:e2e` or `verify` script helps keep commands obvious
- `docs/tooling.md`
- optional: `apps/api/pyproject.toml` and `apps/api/uv.lock` if adding an exact-pinned `pip-audit` dev dependency

**Out of scope**
- Do not add deployment.
- Do not add a broad matrix unless needed.
- Do not add coverage services or badges unless the README plan asks for them.

## Git workflow

- Branch: `codex/008-add-ci-verification-baseline`
- Commit message style: `ci: add verification workflow`

## Steps

### Step 1: Add the minimal GitHub Actions workflow

Create `.github/workflows/ci.yml` with one workflow on pull requests and pushes to `main`. Use exact major action pins at minimum, and prefer full SHAs if the repo standard is tightened. The workflow should contain:

- `verify`: exact-version check, lint, typecheck, unit/API tests, extraction metrics, JS audit, and Python audit if added.
- `e2e`: Playwright E2E only, with `needs: verify`.

The jobs should:

1. Check out the repo.
2. Set up Node matching the local `pnpm` lock expectations.
3. Enable the exact `pnpm@11.8.0`.
4. Install dependencies with `pnpm install --frozen-lockfile`.
5. Set up Python 3.12.
6. Install uv.
7. Run `cd apps/api && uv sync`.
8. Run the verification commands listed above, including E2E.

Keep the workflow readable and boring.

**Verify**: run all commands locally from the table.

### Step 2: Decide the Python audit baseline

Add `pip-audit` to `[dependency-groups].dev` with an exact version and update `uv.lock`. Add a CI step `cd apps/api && uv run pip-audit`.

Stop and document Python dependency auditing as deferred only if adding `pip-audit` requires loosening exact pinning or immediately produces noisy advisories that cannot be triaged in this plan.

**Verify**: if added, `cd apps/api && uv run pip-audit` exits 0 or reports only advisories explicitly triaged in the plan/index.

### Step 3: Make root verification discoverable

Add root scripts:

- `"test:e2e": "pnpm --filter web test:e2e"`
- `"verify": "pnpm check:versions && pnpm lint && pnpm typecheck && pnpm test && pnpm --filter web test:e2e"`

Keep extraction metrics as a separately documented local command unless a later plan adds a longer `verify:full`. CI still runs extraction metrics.

Keep exact dependency policy unchanged.

**Verify**: `pnpm check:versions` exits 0.

### Step 4: Update tooling docs

Update `docs/tooling.md` with the CI command set and any dependency audit decision. Do not expand public `README.md` here; that belongs to plan 011.

**Verify**: `rg -n "CI|test:e2e|audit" docs/tooling.md` shows the documented commands.

## Test plan

This plan is itself verification infrastructure. New code tests are not required unless scripts change. The done criteria are the complete local command set and a valid workflow file.

## Done criteria

- [ ] `.github/workflows/ci.yml` exists.
- [ ] CI runs on pull requests and pushes to `main`.
- [ ] CI has a `verify` job and a separate `e2e` job with `needs: verify`.
- [ ] CI runs exact-version check, lint, typecheck, unit/API tests, E2E, and extraction metrics.
- [ ] JS dependency audit gates high/critical production advisories.
- [ ] Python dependency audit is added with exact-pinned `pip-audit`, or explicitly documented as deferred because a STOP condition occurred.
- [ ] Root `pnpm verify` exists and is documented.
- [ ] `pnpm check:versions`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm --filter web test:e2e` all exit 0 locally.

## STOP conditions

- GitHub Actions cannot be used for this repo.
- Adding `pip-audit` requires loosening exact dependency pinning.
- The E2E server startup is flaky locally after two clean retries.

## Maintenance notes

Keep CI minimal. This repo should not grow deployment, preview, or coverage services until the maintainer explicitly asks.
