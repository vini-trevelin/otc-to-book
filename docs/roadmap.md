# Roadmap

## V1: Deterministic Market Book

- Chat simulator with User and Auto modes.
- Deterministic quote extraction.
- Pydantic schemas.
- Validation.
- In-memory book with active/stale rows.
- Real-time workstation UI.
- Unit, integration, and E2E tests.

## Phase 2: Multiple Brokers

Multiple brokers produce quote streams. Book aggregates across brokers.

Examples:

- Broker A.
- Broker B.
- Broker C.

## Phase 3: Broker Fingerprinting

Learn broker-specific quote patterns.

Examples:

- Broker A: `vendo {ticker} {spread} {size}`
- Broker B: `{size}mm {ticker} @{spread}`

Desired future:

```text
Broker
  -> Broker Classifier
  -> Deterministic Parser
  -> Fallback LLM
  -> Book
```

Do not build in V1.

## Phase 4: Quote Lifecycle

Support:

- `ACTIVE`
- `CANCELLED`
- `EXPIRED`
- `REPLACED`

Do not build lifecycle events in V1. V1 only visually marks superseded rows stale.

## Phase 5: Evaluation Dataset

Create benchmark datasets:

- message.
- expected quote.

Measure:

- ticker accuracy.
- side accuracy.
- quantity accuracy.
- price accuracy.

V1 should still seed evaluation-ready fixtures by including expected extraction fields beside sample messages. Full metrics and reporting stay Phase 5.
