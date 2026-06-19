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
  -> Fallback LLM
  -> Book
```

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
