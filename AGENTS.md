# Agent Routing

This repository is an OTC-to-Book quant engineering project. Treat the user as architect. Agents implement only agreed scope, keep changes surgical, and verify with tests.

## Read Order

Before non-trivial work, read these files in order:

1. `docs/project-brief.md`
2. `docs/architecture.md`
3. `docs/domain-model.md`
4. `docs/extraction-strategy.md`
5. `docs/frontend.md`
6. `docs/tooling.md`
7. `docs/roadmap.md`
8. `tasks/todo.md`

## Operating Rules

- Plan before coding.
- Keep business logic in backend/domain layers.
- Do not build future roadmap phases unless a plan explicitly says so.
- Pin every dependency version exactly.
- Add or update tests for any changed logic.
- Prefer deterministic, testable parsing in V1.
- Preserve quant guardrails: timestamp correctness, index alignment, units, signs, deterministic behavior, diagnosable failures.
- Commit messages follow `verb: description`, for example `docs: update architecture notes`.

## Documentation Ownership

- Project and LLM-facing documentation belongs in `docs/` and `tasks/`.
- `README.md` is for clean public repo objective, quickstart, and demo media.
- Do not expand `README.md` into long architecture notes; link to `docs/`.
