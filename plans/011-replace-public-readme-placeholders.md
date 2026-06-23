# Plan 011: Replace public README placeholders with a concise portfolio quickstart

> **Executor instructions**: Keep this README concise and public-facing. Do not move architecture notes from `docs/` into the README.
>
> **Drift check (run first)**: `git diff --stat fc9ae05..HEAD -- README.md docs/project-brief.md docs/tooling.md docs/roadmap.md`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW, docs only.
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `fc9ae05`, 2026-06-23

## Why this matters

The repository is explicitly a quant developer portfolio app, but `README.md` still contains four `TODO` placeholders. That is the first file a reviewer sees. The detailed project docs are good; the README should route readers to them and provide a clean quickstart, status, and demo placeholder without becoming a long architecture document.

## Current state

- `README.md:5-19` contains placeholder sections: Status, Demo, Setup, Docs.
- `AGENTS.md` says public README is for clean objective, quickstart, and demo media, while architecture belongs in `docs/`.
- `docs/project-brief.md` clearly defines the project as transforming noisy OTC dealer chat into a live market book.
- `docs/tooling.md` lists root commands.

Relevant excerpt:

```md
# OTC-to-Book

Transform noisy OTC dealer chat messages into normalized quote events and a live consolidated market book.

## Status

TODO
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Docs sanity | `rg -n "TODO" README.md` | no matches unless intentionally documenting a future demo placeholder |
| Verification | `pnpm check:versions` | exit 0 |

## Scope

**In scope**
- `README.md`

**Out of scope**
- Do not edit architecture, roadmap, or task docs unless a link is broken.
- Do not add badges unless CI exists from plan 008.
- Do not add marketing copy or exaggerated claims.

## Git workflow

- Branch: `codex/011-replace-public-readme-placeholders`
- Commit message style: `docs: update public readme`

## Steps

### Step 1: Rewrite README with concise sections

Replace placeholders with:

- Objective: one paragraph.
- Current status: V1 deterministic market book, chaotic evaluation, bounded fuzzy resolver, live workstation.
- Quickstart:
  - `pnpm install`
  - `cd apps/api && uv sync`
  - `pnpm dev`
  - open `http://localhost:3000`
- Verification:
  - `pnpm check:versions`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm --filter web test:e2e`
  - `cd apps/api && uv run python scripts/evaluate_extraction.py`
- Demo media: a short placeholder such as "Demo GIF/video to be added" if no media exists.
- Docs links:
  - `docs/project-brief.md`
  - `docs/architecture.md`
  - `docs/domain-model.md`
  - `docs/extraction-strategy.md`
  - `docs/frontend.md`
  - `docs/roadmap.md`

Keep it factual and sparse.

**Verify**: `rg -n "TODO" README.md` returns no placeholder TODOs.

### Step 2: Check commands remain accurate

Run `pnpm check:versions`. Optionally run `pnpm lint` if command documentation changed in a way that could mislead.

**Verify**: command exits 0.

## Test plan

Docs-only. No app tests required unless command names change.

## Done criteria

- [ ] README has no placeholder `TODO` sections.
- [ ] README includes a working local quickstart.
- [ ] README links to detailed docs instead of duplicating them.
- [ ] `pnpm check:versions` exits 0.

## STOP conditions

- The repo gains demo media before this plan runs; include the real media path instead of a placeholder.
- CI badges are requested but plan 008 has not landed.

## Maintenance notes

Keep README short. If a section wants more than a few bullets, link to `docs/` instead.
