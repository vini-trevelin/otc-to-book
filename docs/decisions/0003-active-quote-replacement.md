# ADR 0003: Active Quote Replacement Rule

## Status

Accepted.

## Context

The book should show best bid/ask at top and retain previous prices as visually muted stale rows when a broker updates price.

## Decision

V1 active quote key is:

```text
(broker_id, instrument_id, side)
```

A new valid quote for the same key becomes the active book row. The previous active row becomes `SUPERSEDED` in book display state.

## Consequences

- Book has clear current market per broker/instrument/side.
- UI can show stale history without implementing full lifecycle events.
- Future lifecycle support can replace visual-only stale status with explicit events.
