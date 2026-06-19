# Plan 001: Establish Monorepo Docs And Tooling Baseline

> Executor instructions: Follow this plan step by step. Run every verification command and confirm expected result before moving on. If any STOP condition occurs, stop and report.
>
> Drift check: `git status --short && git diff --stat -- AGENTS.md README.md docs tasks plans package.json pnpm-workspace.yaml turbo.json apps data`
> Because this repo has no initial commit at planning time, compare live files against this plan and `tasks/todo.md` manually before editing.

## Status

- Priority: P1
- Effort: M
- Risk: LOW
- Depends on: none
- Category: dx/docs
- Planned at: no commits yet, 2026-06-19

## Why This Matters

The repo is empty except planning docs. V1 needs a reproducible full monorepo before backend or frontend work starts. Exact dependency pinning is a project invariant, so tooling must prevent drift early.

## Current State

Relevant files:

- `AGENTS.md` routes agents to docs and operating rules.
- `docs/` contains project architecture decisions.
- `tasks/todo.md` orchestrates plan execution.
- `plans/` contains this implementation plan set.
- `START_PROMPT.md` has been removed after its content was represented in `docs/project-brief.md`.
- Commit messages follow `verb: description`.

No root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `apps/`, or `data/` structure exists yet.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Check Node | `node --version` | exit 0 |
| Check Corepack | `corepack --version` | exit 0 |
| Check Python | `python3 --version` | exit 0 |
| Check uv | `uv --version` | exit 0 |
| Check package ranges | `node scripts/check-exact-versions.mjs` | exit 0, no floating ranges |

If `uv` or `corepack` is missing, STOP and report; do not install global tools without architect approval.

## Scope

In scope:

- Root monorepo config.
- `apps/api` skeleton only.
- `apps/web` skeleton only.
- `data/samples` directory and sample files.
- `scripts/check-exact-versions.mjs`.
- `.gitignore`.
- `.pre-commit-config.yaml`.
- Documentation updates in `docs/`, `tasks/`, `plans/`.

Out of scope:

- Implementing backend domain logic.
- Implementing frontend UI.
- Installing unpinned dependencies.
- Adding CI unless explicitly approved.

## Git Workflow

- Branch: `codex/v1-planning-or-scaffold` if a branch is needed.
- Do not commit, push, or open PR unless instructed.

## Steps

### Step 1: Create Root Workspace Files

Create:

- `package.json`
- `pnpm-workspace.yaml`
- `turbo.json`
- `.gitignore`

`package.json` must include exact `packageManager`, scripts, and exact dev dependencies only. No `^` or `~`.

Suggested root scripts:

- `dev`: `turbo dev`
- `test`: `turbo test`
- `lint`: `turbo lint`
- `typecheck`: `turbo typecheck`
- `check:versions`: `node scripts/check-exact-versions.mjs`

Verify:

```sh
node -e "const p=require('./package.json'); if(!p.packageManager) process.exit(1); console.log(p.packageManager)"
```

Expected: prints pinned package manager such as `pnpm@<exact>`.

### Step 2: Add Exact-Version Guard Script

Create `scripts/check-exact-versions.mjs`.

It must inspect every `package.json` under repo except ignored directories and fail if dependency spec starts with:

- `^`
- `~`
- `*`
- `latest`

It should check:

- `dependencies`
- `devDependencies`
- `peerDependencies`
- `optionalDependencies`

Verify:

```sh
node scripts/check-exact-versions.mjs
```

Expected: exit 0.

### Step 3: Create App Skeletons

Create directories:

```text
apps/api/src/otc_to_book/
apps/api/tests/
apps/web/
data/samples/
```

Create placeholder package/config files but no domain/UI implementation yet:

- `apps/api/pyproject.toml`
- `apps/api/README.md`
- `apps/web/README.md`

Python dependencies in `apps/api/pyproject.toml` must use exact `==`.

Verify:

```sh
find apps data -maxdepth 4 -type d | sort
```

Expected: shows `apps/api`, `apps/web`, and `data/samples`.

### Step 4: Add Sample Messages

Create `data/samples/v1_messages.jsonl`, `data/samples/v1_messages.csv`, and `data/samples/v1_expected_quotes.jsonl`.

Include at least:

- 5 valid quote templates.
- 4 noise messages.
- replacement sequence for same `(broker_id, instrument_id, side)`.
- timestamps.
- expected fields for valid messages: `instrument_id`, `side`, `quote_value`, `quote_value_type`, `quantity`, `quantity_unit`.
- expected rejection reason for noise messages.

Verify:

```sh
wc -l data/samples/v1_messages.jsonl data/samples/v1_messages.csv data/samples/v1_expected_quotes.jsonl
```

Expected: all files non-empty.

### Step 5: Add Pre-Commit Config

Create `.pre-commit-config.yaml` with exact hook `rev` pins. Include at minimum:

- ruff check/format for API.
- generic whitespace/end-of-file checks.

If exact current hook versions are unknown, look them up before writing or STOP and ask. Do not use floating refs.

Verify:

```sh
python3 - <<'PY'
from pathlib import Path
p = Path('.pre-commit-config.yaml')
text = p.read_text()
assert 'rev:' in text
assert 'latest' not in text
print('pre-commit pinned')
PY
```

Expected: `pre-commit pinned`.

### Step 6: Confirm Bootstrap Prompt Duplication Is Removed

Confirm `START_PROMPT.md` is absent and `docs/project-brief.md` preserves the project brief content. Keep all project docs under `docs/`.

Verify:

```sh
test ! -e START_PROMPT.md && test -e docs/project-brief.md
```

Expected: exit 0.

## Test Plan

This plan is tooling/docs only. Verification is command-based:

- version guard passes.
- workspace files parse.
- sample files exist.
- no floating versions.

## Done Criteria

- [ ] Root monorepo config exists.
- [ ] `apps/api`, `apps/web`, and `data/samples` exist.
- [ ] Exact-version guard exists and passes.
- [ ] Python dependency pins use `==`.
- [ ] JS dependency specs contain no `^`, `~`, `*`, or `latest`.
- [ ] `START_PROMPT.md` removed after content preservation.
- [ ] `data/samples/v1_expected_quotes.jsonl` exists with expected parser outputs/rejections.
- [ ] `AGENTS.md` or `docs/tooling.md` documents commit pattern `verb: description`.
- [ ] `tasks/todo.md` and `plans/README.md` mark Plan 001 DONE.

## STOP Conditions

Stop and report if:

- Required global tools are missing.
- A generator insists on floating dependency ranges and cannot be corrected cleanly.
- Exact versions cannot be determined.
- Any step appears to require implementing backend or frontend behavior.

## Maintenance Notes

All future plans depend on this baseline. Reviewers should inspect dependency pins carefully before accepting scaffold changes.
