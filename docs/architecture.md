# Architecture

## Core Decision

V1 uses deterministic-first extraction behind a `QuoteExtractor` interface. LLM extraction is a future adapter, not part of V1 runtime behavior.

## Event Flow

```text
RawMessage
  -> QuoteExtractor
  -> TickerResolver
  -> QuoteCandidate
  -> QuoteValidator
  -> QuoteEvent | QuoteRejected
  -> BookBuilder
  -> BookState
  -> WebSocket broadcast
```

## Backend Ownership

The backend owns:

- Message ingestion.
- Auto simulator.
- Sample replay parsing.
- Extraction.
- Session-scoped ticker resolution.
- Validation.
- Book state.
- Event broadcasting.

The frontend owns:

- Controls for user input and simulator params.
- Rendering chat, parsed events, and book state.
- Client-side connection state and UI errors.

The frontend does not own extraction decisions, provider API keys, or direct
model-server calls. Future fuzzy or LLM provider configuration must be validated
and applied by the backend; dashboard controls are a control plane only.

## API Shape

V1 should be WebSocket-first.

All WebSocket messages use a stable event envelope:

```text
{
  "event_id": "uuid",
  "event_type": "book_updated",
  "schema_version": 1,
  "sequence": 42,
  "session_id": "uuid",
  "correlation_id": "uuid",
  "occurred_at": "2026-06-19T12:00:00Z",
  "payload": {}
}
```

Envelope rules:

- `event_id` uniquely identifies this emitted event.
- `event_type` is one of the documented event names.
- `schema_version` starts at `1` and changes only through explicit contract changes.
- `sequence` is monotonically increasing per backend session.
- `session_id` identifies one running API process/session.
- `correlation_id` links all events caused by one input message, simulator tick, or replay item.
- `occurred_at` is timezone-aware UTC.
- `payload` contains event-specific data.

Client-to-server events:

- `user_message`: user submits a chat message.
- `simulator_start`: start auto message generation.
- `simulator_stop`: stop auto generation.
- `book_clear`: clear all current book rows for the running backend session.

Server-to-client events:

- `message_received`: raw message accepted.
- `quote_parsed`: extractor produced a candidate.
- `quote_rejected`: candidate failed validation or message was noise.
- `quote_event`: valid immutable event created.
- `book_updated`: book state changed.

Clear rules:

- `book_clear` emits a `book_updated` event with an empty `books` payload.
- Clearing books does not erase raw message history, parsed event history, simulator state, or the session-scoped ticker resolver.
- The control is a workstation reset affordance for display/book rows only, not a full session reset.

HTTP endpoints:

- `GET /health`
- `POST /samples/replay` for CSV/JSON sample replay.

Replay rules:

- Replayed rows are processed in file order.
- Each replay receives a `replay_id`.
- Each replay item receives a 1-based `replay_sequence`.
- Replaying the same file is allowed and creates new message/event IDs.
- Malformed rows emit rejection events when possible and do not stop the full replay unless the file itself cannot be parsed.

## Monorepo Shape

```text
apps/
  api/
    pyproject.toml
    src/otc_to_book/
      api/
      application/
      domain/
      simulator/
    tests/
  web/
    app/
    components/
    lib/
    tests/
data/
  samples/
docs/
tasks/
```

Root tooling:

- pnpm workspace.
- Turborepo.
- uv for Python API.
- pre-commit.

## Contract Location

V1 may keep Python Pydantic models and matching TypeScript types hand-written. The event names, envelope fields, and payload semantics in this document are the source of truth until a generated contract package is introduced.

## Future Compatibility

V1 should leave clean extension points for:

- Multiple brokers.
- Broker classifier.
- Broker-specific deterministic parsers.
- LLM fallback extractor.
- Quote lifecycle events.
- Evaluation datasets and parser metrics.
- Backend-owned extraction provider profiles with URL allowlists, timeouts, and secret references.

Do not implement those future phases in V1.
