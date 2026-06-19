# Implementation Plans

Generated on 2026-06-19 for repo state: no commits yet. Execute in order unless dependencies say otherwise. Each executor must read the selected plan fully before starting, honor STOP conditions, run verification gates, and update `tasks/todo.md` plus this index when done.

## Execution Order & Status

| Plan | Title | Priority | Effort | Depends on | Status |
|------|-------|----------|--------|------------|--------|
| 001 | Establish monorepo docs and tooling baseline | P1 | M | - | DONE |
| 002 | Build backend domain pipeline | P1 | L | 001 | DONE |
| 003 | Build realtime workstation UI | P1 | L | 001, 002 | TODO |
| 004 | Verify V1 and polish README | P1 | M | 001, 002, 003 | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED.

## Dependency Notes

- Plan 002 depends on Plan 001 for Python project setup, pinned tooling, and baseline commands.
- Plan 003 depends on Plan 002 because UI consumes backend WebSocket contracts.
- Plan 004 depends on all implementation plans because it verifies the complete V1 story.
- Contract tightening from review is incorporated into Plans 001-004: event envelopes, extractor boundary, instrument/quote value modeling, evaluation fixtures, simulator/replay ordering, and V1 dependency scope.

## Scope Guard

These plans implement V1 only. Do not build broker fingerprint learning, LLM extraction, production persistence, quote lifecycle events, or trading logic.
