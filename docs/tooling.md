# Tooling

## Version Policy

Every dependency must be pinned exactly.

JavaScript/TypeScript:

- Use exact versions in `package.json`.
- No `^`.
- No `~`.
- Commit `pnpm-lock.yaml`.
- Pin `packageManager`, for example `pnpm@<exact>`.

Python:

- Use exact `==` versions in `apps/api/pyproject.toml`.
- Commit `uv.lock`.

Pre-commit:

- Pin hook `rev` values exactly.

## Tooling

Root:

- pnpm workspace.
- Turborepo.
- TypeScript tooling for web.

Backend:

- Python.
- FastAPI.
- Pydantic.
- pytest.
- ruff.
- uv.

Deferred backend libraries:

- Polars.
- DuckDB.

Do not install deferred libraries in V1 unless a plan explicitly brings their runtime use into scope.

Frontend:

- Next.js.
- TypeScript.
- Tailwind.
- shadcn/ui with Base UI style configuration (`apps/web/components.json` style `base-mira`).
- Playwright for E2E.

## Root Commands

Commands:

- `pnpm install`
- `pnpm dev`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm verify`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter web test:e2e`
- `pnpm check:versions`

API commands:

- `cd apps/api && uv sync`
- `cd apps/api && uv run pytest`
- `cd apps/api && uv run ruff check .`
- `cd apps/api && uv run python scripts/evaluate_extraction.py`
- `cd apps/api && uv run pip-audit`

CI:

- `.github/workflows/ci.yml` runs on pull requests and pushes to `main`.
- `verify` job runs exact-version checks, lint, typecheck, unit/API tests, extraction metrics, JS high/critical audit, and Python dependency audit.
- `e2e` job depends on `verify` and runs Playwright Chromium tests.
- Local `pnpm verify` mirrors the common local gate and includes E2E. Extraction metrics remain a separate documented local command.

## Install Rule

When installing libraries, use exact-version flags or manually pin versions immediately after install. If a generator creates floating ranges, fix them before continuing.

## Commit Messages

Use:

```text
verb: description
```

Examples:

- `docs: update architecture notes`
- `api: implement deterministic quote parser`
- `web: add realtime book panel`
