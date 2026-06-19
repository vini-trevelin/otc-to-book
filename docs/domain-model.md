# Domain Model

## Vocabulary

- Raw message: original broker chat text plus broker and receive timestamp.
- Quote candidate: extractor output; may be incomplete or invalid.
- Quote event: validated immutable quote update accepted by the book.
- Quote rejection: validation/extraction failure with reason.
- Book state: current and stale quote rows grouped by ticker.
- Instrument: normalized tradable identifier derived from raw ticker text.
- Quote value: market value being quoted, represented as a Decimal plus explicit kind.

## Side Normalization

Normalize sides to:

- `BID`
- `ASK`

V1 Portuguese handling:

- `vendo`, `offer` -> `ASK`
- `bid`, `compro`, `tomo ... ate` -> `BID`

## Instrument Normalization

V1 must preserve both raw and normalized instrument identifiers:

- `raw_ticker`: text as extracted from the message.
- `instrument_id`: normalized uppercase identifier used by validation and book state.

Example:

- raw `petro27` -> instrument `PETRO27`

Do not add a full instrument master in V1. Keep the field shape compatible with one later.

## Quote Value

V1 examples behave like price/spread quotes. Model the value explicitly:

- `quote_value: Decimal`
- `quote_value_type: PRICE | SPREAD`

Default V1 type is `PRICE` unless a parser rule explicitly identifies spread semantics. This avoids overloading a generic `price` field when future instruments quote spreads.

## QuoteCandidate

Extractor output. May be invalid.

Fields:

- `raw_ticker: str | None`
- `instrument_id: str | None`
- `side: BID | ASK | None`
- `quote_value: Decimal | None`
- `quote_value_type: PRICE | SPREAD | None`
- `quantity: Decimal | None`
- `quantity_unit: MM | UNITS | None`
- `broker_id: str`
- `confidence: Decimal`
- `received_timestamp: datetime`
- `processed_timestamp: datetime`
- `raw_message_id: str`
- `raw_message: str`
- `extraction_method: str`
- `extraction_errors: list[str]`

Use `Decimal`, not float.

## QuoteEvent

Validated immutable event accepted by book.

Fields:

- `event_id: str`
- `raw_ticker: str`
- `instrument_id: str`
- `side: BID | ASK`
- `quote_value: Decimal`
- `quote_value_type: PRICE | SPREAD`
- `quantity: Decimal`
- `quantity_unit: MM | UNITS`
- `broker_id: str`
- `confidence: Decimal`
- `received_timestamp: datetime`
- `processed_timestamp: datetime`
- `raw_message_id: str`
- `raw_message: str`
- no mutable lifecycle status; quote events are immutable facts.

## QuoteRejected

Fields:

- `rejection_id: str`
- `raw_message_id: str`
- `broker_id: str`
- `raw_message: str`
- `received_timestamp: datetime`
- `processed_timestamp: datetime`
- `reasons: list[str]`
- `candidate: QuoteCandidate | None`

## Book Rules

Active book key:

```text
(broker_id, instrument_id, side)
```

When a new valid quote arrives for the same active key:

- New quote becomes the active book row.
- Prior active book row becomes `SUPERSEDED` in book display state.
- No cancel/expiry lifecycle event is emitted in V1.

Display per ticker:

- Best bid and best ask at top.
- Active ladder rows sorted first.
- Stale rows retained but visually muted.
- Columns include side, price, size, broker, received timestamp, age, and status.

Sorting:

- Bids: higher price first.
- Asks: lower price first.
- Ties: newest first.

## Validation Invariants

Reject candidates when:

- Missing raw ticker or normalized instrument ID.
- Missing or invalid side.
- Missing quote value.
- Missing quote value type.
- Missing or non-positive quantity.
- Confidence outside accepted range.
- Quote value cannot be parsed as Decimal.
- Timestamps are missing or malformed.

Crossed-market validation should be conservative in V1. Do not reject a standalone bid only because it is above another broker's ask unless the plan explicitly adds crossed-book rules. OTC chat can be stale, fragmented, or broker-specific.
