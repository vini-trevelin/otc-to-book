# Lessons

Record user corrections and architectural lessons here after review.

## Current Lessons

- V1 extraction is deterministic-first behind an abstraction; LLM is future adapter.
- WebSocket-first backend event stream is accepted.
- Full monorepo is required.
- Project/LLM docs belong under `docs/` and `tasks/`; README stays clean/public-facing.
- Exact version pinning is mandatory for every library/tool.
- Book active key is `(broker_id, instrument_id, side)`.
- New quote from same broker/instrument/side makes prior active quote stale for visual display.
- Review correction: active book key should use normalized `instrument_id`, not raw ticker.
- Review correction: WebSocket events need a stable envelope with schema version, sequence, session ID, correlation ID, and UTC timestamp.
- Review correction: extractor returns `ExtractionResult`; validation/application creates `QuoteRejected`.
- Review correction: quote value needs explicit `quote_value_type` to support future price/spread conventions.
- Review correction: V1 samples need expected outputs so parser evaluation can grow naturally later.
- Review correction: commit messages follow `verb: description`.
- Completed implementation plans should be removed once their durable decisions are represented in `docs/` and `tasks/`.
