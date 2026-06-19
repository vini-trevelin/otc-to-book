# Task Orchestrator

Status values: TODO | IN PROGRESS | DONE | BLOCKED.

## Current Execution Plan

| Order | Plan | Status | Notes |
|-------|------|--------|-------|
| 1 | `plans/001-repo-docs-and-tooling.md` | DONE | Monorepo scaffold, exact pinning, sample fixtures, lockfiles, and baseline checks established. |
| 2 | `plans/002-api-domain-pipeline.md` | TODO | Build backend domain pipeline and tests. |
| 3 | `plans/003-web-realtime-workstation.md` | TODO | Build Next.js workstation and E2E tests. |
| 4 | `plans/004-verification-and-readme.md` | TODO | Full verification pass, demo media placeholders, README polish. |

## Review Gate

Stop after planning for user architecture review before V1 implementation.

## Working Agreements

- User is architect.
- Agent must not silently expand scope.
- Plans are executable handoff specs.
- All version pins exact.
- Business logic stays backend/domain.
- Tests required for changed logic.
