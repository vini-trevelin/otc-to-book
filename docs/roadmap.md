# Roadmap

## V1: Deterministic Market Book

- Chat simulator with User and Auto modes.
- Deterministic quote extraction.
- Session-scoped valid ticker pool with explicit alias canonicalization.
- Pydantic schemas.
- Validation.
- In-memory book with active/stale rows.
- Real-time workstation UI.
- Unit, integration, and E2E tests.

## V1.1: Extractor Evaluation

- Deterministic ticker alias regression fixtures.
- Extraction evaluation command with ticker, side, quote value, quantity, rejection reason, and exact-row metrics.
- No fuzzy matching or LLM runtime behavior.

## V1.2: Bounded Fuzzy Design

Plan fast local fuzzy candidate extraction behind the evaluation harness.
Fuzzy matching must be bounded by a known canonical universe or alias set and
must prioritize false-positive control.

## V1.3: Backend-Owned Provider Config

Design optional Ollama/OpenAI-compatible LLM fallback as backend-owned provider
profiles. The dashboard may select from safe profiles, but API keys, model server
URLs, allowlists, timeouts, and validation remain backend responsibilities.

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
  -> Bounded Fuzzy Candidate Extractor
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
