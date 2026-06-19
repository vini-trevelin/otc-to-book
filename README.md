# OTC-to-Book

Portfolio-quality quant developer project: transform noisy OTC dealer chat messages into normalized quote events and a live consolidated market book.

V1 implements a deterministic, event-driven pipeline:

```text
Message -> Quote Extraction -> Validation -> Quote Event -> Book Builder -> Book State
```

## Quickstart

```sh
pnpm install
cd apps/api && uv sync && cd ../..
pnpm dev
```

Open the web app at `http://127.0.0.1:3000`.

## V1

- FastAPI backend with WebSocket event stream.
- Deterministic quote extraction for supported OTC chat templates.
- Pydantic domain models with Decimal quote values and UTC timestamps.
- Validation and rejection events.
- In-memory book with active and superseded rows.
- Next.js workstation: chat, consolidated book, parsed events.
- User mode, auto simulator, and sample replay endpoint.
- Unit, integration, and E2E tests.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter web test:e2e
node scripts/check-exact-versions.mjs
```

## Docs

- `docs/project-brief.md` - full project brief
- `docs/architecture.md` - event-driven system design
- `docs/domain-model.md` - quote/book schema and invariants
- `docs/extraction-strategy.md` - deterministic V1 extraction and future LLM fallback
- `docs/frontend.md` - workstation UI plan
- `docs/tooling.md` - pinned tooling and commands
- `docs/roadmap.md` - future phases

## Demo

GIF/video examples will be added from the V1 workstation flow.
