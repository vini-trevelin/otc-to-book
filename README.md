# OTC-to-Book

Portfolio-quality quant developer project: transform noisy OTC dealer chat messages into normalized quote events and a live consolidated market book.

V1 builds a deterministic, event-driven pipeline:

```text
Message -> Quote Extraction -> Validation -> Quote Event -> Book Builder -> Book State
```

## Current Status

Planning phase. See `tasks/todo.md` and `plans/`.

## Docs

- `docs/project-brief.md` - full project brief
- `docs/architecture.md` - event-driven system design
- `docs/domain-model.md` - quote/book schema and invariants
- `docs/extraction-strategy.md` - deterministic V1 extraction and future LLM fallback
- `docs/frontend.md` - workstation UI plan
- `docs/tooling.md` - pinned tooling and commands
- `docs/roadmap.md` - future phases

## Demo

GIF/video examples will be added after V1 implementation.
