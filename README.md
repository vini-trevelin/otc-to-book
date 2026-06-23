# OTC-to-Book

Transform noisy OTC dealer chat messages into normalized quote events and a live consolidated market book.

## Status

V1 deterministic market book:

- FastAPI backend with deterministic extraction, validation, bounded fuzzy ticker resolution, and in-memory book state.
- Next.js workstation with live broker input, replay upload, simulator controls, parsed events, and consolidated book cards.
- Chaotic extraction fixtures, false-merge metrics, unit/API tests, and Playwright E2E coverage.

## Demo

Demo media will be added after the current workstation flow stabilizes.

## Quickstart

```bash
pnpm install
cd apps/api && uv sync
cd ../..
pnpm dev
```

Open `http://localhost:3000`.

## Verification

```bash
pnpm check:versions
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
cd apps/api && uv run python scripts/evaluate_extraction.py
```

## Docs

- [Project brief](docs/project-brief.md)
- [Architecture](docs/architecture.md)
- [Domain model](docs/domain-model.md)
- [Extraction strategy](docs/extraction-strategy.md)
- [Frontend](docs/frontend.md)
- [Roadmap](docs/roadmap.md)
