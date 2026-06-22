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
- session-scoped `TickerResolver` for explicit aliases, bounded fuzzy matching, and valid ticker discovery

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
  -> exact session valid ticker pool lookup
  -> bounded fuzzy lookup against the session valid ticker pool
  -> new session valid ticker
  -> QuoteCandidate.instrument_id
```

Rules:

- known typo aliases map to a canonical instrument before validation, currently `PETROO27`, `PETRRO27`, and `PETR027` -> `PETRO27`;
- `PETR27` remains distinct from `PETRO27`;
- unknown valid-looking tickers become new valid tickers in the running backend session;
- the pool is in-memory only and does not persist across restarts;
- bounded fuzzy matching is enabled after explicit aliases and exact pool lookup;
- fuzzy candidates come only from the current session valid ticker pool;
- fuzzy matching requires an exact numeric suffix match, alphabetic roots of at least four characters, and exactly one root edit, including one adjacent transposition;
- ambiguous fuzzy matches are not merged and instead create a new session ticker;
- hard-negative exclusions currently include `PETR27` and `BOVE26`.

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

Future LLM stages must remain behind the `QuoteExtractor` interface and
must be gated by extraction metrics. Deterministic parsing and ticker resolution
run first. Bounded fuzzy extraction proposes candidates only from the session
valid ticker pool and is measured by false-merge fixtures. Optional LLM fallback may run only after
deterministic and fuzzy stages fail or produce low confidence, and must use
structured output, a bounded timeout, and the same `QuoteValidator` gate before
book updates.

The evaluation set includes clean examples, chaotic positive examples,
hard-negative false-merge examples, and rejection examples. Fuzzy quality is
tracked by exact-row accuracy and false-merge counts; false merges must remain
zero before expanding fuzzy coverage.

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
