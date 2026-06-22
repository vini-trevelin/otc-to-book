# Extraction Strategy

## V1 Decision

Use deterministic-first extraction in V1.

Reason:

- Current examples are template-like.
- Deterministic parsing is unit-testable.
- Parser quality can be measured directly.
- Future LLM fallback remains clean through an interface.

## Interface

Define a `QuoteExtractor` protocol/interface with one responsibility:

```text
extract(raw_message: RawMessage) -> ExtractionResult
```

`ExtractionResult` contains:

- `candidate: QuoteCandidate | None`
- `errors: list[ExtractionError]`
- `method: str`
- `confidence: Decimal`

Extractor does not create `QuoteRejected`. Rejection belongs to the validation/application layer so extraction, validation, and observability stay separable.

V1 implementation:

- `DeterministicQuoteExtractor`
- session-scoped `TickerResolver` for explicit aliases and valid ticker discovery

Future adapters:

- `LLMQuoteExtractor`
- `BrokerSpecificQuoteExtractor`
- `HybridQuoteExtractor`

## V1 Template Coverage

Support at least these patterns:

- `vendo {ticker} {price} {size}mm`
- `{ticker} OFFER {price} SIZE {size}`
- `{size}mm {ticker} @{price}`
- `bid {ticker} {price}`
- `tomo {ticker} ate {price}`

Parser should be case-insensitive and tolerate common accents by normalization:

- `até` -> `ate`

## V1 Ticker Resolution

After a template extracts `raw_ticker`, V1 resolves the book-facing `instrument_id`
deterministically:

```text
raw_ticker
  -> uppercase lexical normalization
  -> explicit alias map
  -> session valid ticker pool
  -> QuoteCandidate.instrument_id
```

Rules:

- known typo aliases map to a canonical instrument before validation, currently `PETROO27`, `PETRRO27`, and `PETR027` -> `PETRO27`;
- `PETR27` remains distinct from `PETRO27`;
- unknown valid-looking tickers become new valid tickers in the running backend session;
- the pool is in-memory only and does not persist across restarts;
- no edit-distance fuzzy merge runs in V1.

## Price Normalization

Support:

- Decimal-style input: `7.30`
- Compact spread input after `@`: `@730` -> `7.30`

Keep price as `Decimal`.

## Noise Handling

Noise messages should produce `ExtractionResult(candidate=None, errors=[NO_QUOTE_DETECTED])`. The application pipeline converts that result into a `QuoteRejected` event.

Examples:

- `bom dia`
- `sem mercado agora`
- `call me`
- `alguem tem fluxo?`

## Future Broker Fingerprinting

Future desired pipeline:

```text
Broker
  -> Broker Classifier
  -> Deterministic Parser
  -> Bounded Fuzzy Candidate Extractor
  -> Fallback LLM
  -> Book
```

Future fuzzy/LLM stages must remain behind the `QuoteExtractor` interface and
must be gated by extraction metrics. Deterministic parsing and ticker resolution
run first. Bounded fuzzy extraction may later propose candidates only from a known
canonical universe or alias set. Optional LLM fallback may run only after
deterministic and fuzzy stages fail or produce low confidence, and must use
structured output, a bounded timeout, and the same `QuoteValidator` gate before
book updates.

Before fuzzy matching is enabled, the evaluation set must include chaotic
positive examples and hard-negative false-merge examples. Initial bounded fuzzy
rules should require an exact numeric suffix match, a very small alphabetic-root
edit distance, explicit exclusions such as `PETR27`, and zero ambiguous matches.

Future provider configuration is backend-owned. The frontend may select from
backend-advertised provider profiles, but it must not hold API keys or submit
arbitrary provider URLs. Provider config should use backend references such as
`base_url_ref`, `api_key_ref`, `timeout_ms`, and `confidence_threshold`.

V1 should not implement broker learning. It should preserve:

- `broker_id` on every message/event.
- `extraction_method`.
- rejection reasons.
- raw message IDs.
- raw and normalized instrument identifiers.
- parser template ID when a deterministic template matched.

These fields enable later parser evaluation and broker-pattern discovery.

## Rejection Taxonomy

Use stable reason codes:

- `NO_QUOTE_DETECTED`
- `MISSING_TICKER`
- `MISSING_SIDE`
- `MISSING_QUOTE_VALUE`
- `MISSING_QUANTITY`
- `INVALID_QUANTITY`
- `INVALID_CONFIDENCE`
- `INVALID_TIMESTAMP`
- `UNSUPPORTED_TEMPLATE`
