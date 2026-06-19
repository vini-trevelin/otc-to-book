# Project Brief

OTC-to-Book is a portfolio-quality quant developer project focused on transforming fragmented, unstructured OTC dealer communications into a consolidated market book.

The goal is not to build a chatbot, RAG system, trading strategy, MCP server, or generic AI agent. The goal is a realistic market-data style pipeline where unstructured dealer chat messages become normalized quote events and aggregate into a live OTC market book.

Think miniature Bloomberg-style OTC quote aggregation from noisy broker chat.

## Example Messages

All supported messages must carry timestamps.

- `vendo petro27 7.30 5mm`
- `PETR27 OFFER 7.30 SIZE 5`
- `5mm petro27 @730`
- `bid petro27 7.25`
- `tomo petro27 ate 7.26`

Messages may be inconsistent, ambiguous, incomplete, noisy, or broker-specific.

## V1 Scope

Build only the first milestone:

- Chat simulator with User and Auto modes.
- Deterministic quote extraction behind an abstraction.
- Normalized quote schema with Pydantic.
- Validation layer.
- In-memory book builder.
- Trading-style UI with real-time updates.
- Sample broker messages.
- Tests and README/demo placeholders.

## Explicit Non-Goals For V1

- No chatbot.
- No RAG system.
- No trading strategy.
- No production broker integration.
- No broker fingerprint learning implementation.
- No quote lifecycle event support beyond visually stale/superseded rows.
- No persistence beyond samples and optional in-memory state.
- No unpinned dependencies.
