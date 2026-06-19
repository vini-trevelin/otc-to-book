# Plan 002: Build Backend Domain Pipeline

> Executor instructions: Follow this plan step by step. Run every verification command and confirm expected result before moving on. If any STOP condition occurs, stop and report.
>
> Drift check: `git diff --stat HEAD -- apps/api docs/domain-model.md docs/architecture.md docs/extraction-strategy.md data/samples`
> If there is no commit yet, compare live files against this plan and docs manually before editing.

## Status

- Priority: P1
- Effort: L
- Risk: MED
- Depends on: `plans/001-repo-docs-and-tooling.md`
- Category: feature/tests
- Planned at: no commits yet, 2026-06-19

## Why This Matters

Backend domain logic is the core product. V1 must prove that noisy chat can become validated quote events and live book state through an event-driven, testable pipeline. This plan keeps domain logic independent from UI and prepares future LLM/broker-specific extractors without building them.

## Current State

Expected after Plan 001:

- `apps/api/pyproject.toml` exists with exact pins.
- `apps/api/src/otc_to_book/` exists.
- `apps/api/tests/` exists.
- `data/samples/` contains sample messages.

Relevant docs:

- `docs/domain-model.md` defines `RawMessage`, `QuoteCandidate`, `QuoteEvent`, `QuoteRejected`, active book key, and validation invariants.
- `docs/extraction-strategy.md` defines deterministic-first V1 extraction.
- `docs/architecture.md` defines WebSocket-first event flow and event envelope.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install API deps | `cd apps/api && uv sync` | exit 0 |
| Unit tests | `cd apps/api && uv run pytest` | all pass |
| Lint | `cd apps/api && uv run ruff check .` | exit 0 |
| Format check | `cd apps/api && uv run ruff format --check .` | exit 0 |

## Scope

In scope:

- `apps/api/src/otc_to_book/domain/`
- `apps/api/src/otc_to_book/application/`
- `apps/api/src/otc_to_book/api/`
- `apps/api/src/otc_to_book/simulator/`
- `apps/api/tests/`
- `apps/api/pyproject.toml` only if missing exact deps/scripts.
- `data/samples/` only to add test samples.

Out of scope:

- Frontend implementation.
- DuckDB persistence.
- Polars analytics.
- LLM provider integration.
- Broker fingerprint learning.
- Production auth.
- Quote cancel/expiry lifecycle events.

## Git Workflow

- Branch: keep current branch unless instructed.
- Do not push or open PR unless instructed.

## Steps

### Step 1: Define Domain Models

Create Pydantic models under `apps/api/src/otc_to_book/domain/models.py`.

Required models/enums:

- `QuoteSide`: `BID`, `ASK`
- `QuantityUnit`: `MM`, `UNITS`
- `QuoteValueType`: `PRICE`, `SPREAD`
- `BookRowStatus`: `ACTIVE`, `SUPERSEDED`
- `RejectionReason`
- `EventEnvelope`
- `ExtractionResult`
- `RawMessage`
- `QuoteCandidate`
- `QuoteEvent`
- `QuoteRejected`
- `BookRow`
- `TickerBook`
- `BookState`

Use `Decimal` for quote value/quantity. Use timezone-aware UTC `datetime`. `QuoteEvent` must be immutable fact data and must not contain mutable lifecycle/display status.

Verify:

```sh
cd apps/api && uv run python -c "from otc_to_book.domain.models import QuoteEvent, QuoteSide; print(QuoteSide.BID.value)"
```

Expected: `BID`.

### Step 2: Implement Deterministic Extractor

Create `apps/api/src/otc_to_book/domain/extraction.py`.

Define:

- `QuoteExtractor` protocol.
- `DeterministicQuoteExtractor`.
- `ExtractionResult`.

Support templates:

- `vendo {ticker} {price} {size}mm`
- `{ticker} OFFER {price} SIZE {size}`
- `{size}mm {ticker} @{price}`
- `bid {ticker} {price}`
- `tomo {ticker} ate {price}`

Rules:

- Case-insensitive.
- Normalize accents for matching only.
- `@730` becomes `Decimal("7.30")`.
- `tomo ... ate` becomes `BID`.
- Extract raw ticker and normalized uppercase `instrument_id`.
- Set `quote_value_type=PRICE` for V1 templates.
- Include deterministic `template_id` for matched templates.
- Noise returns `ExtractionResult(candidate=None, errors=[NO_QUOTE_DETECTED])`.
- Extractor never creates `QuoteRejected`; validation/application layer creates rejections.

Verify:

```sh
cd apps/api && uv run pytest tests/test_extraction.py
```

Expected: all extraction tests pass.

### Step 3: Implement Validator

Create `apps/api/src/otc_to_book/domain/validation.py`.

Validator converts `QuoteCandidate` into `QuoteEvent` or `QuoteRejected`.

Reject:

- missing raw ticker or instrument ID.
- missing side.
- missing quote value.
- missing quote value type.
- missing/non-positive quantity.
- invalid confidence.
- missing timestamps.

Do not reject crossed markets in V1.

Verify:

```sh
cd apps/api && uv run pytest tests/test_validation.py
```

Expected: all validation tests pass.

### Step 4: Implement Book Builder

Create `apps/api/src/otc_to_book/domain/book.py`.

Rules:

- Active book key is `(broker_id, instrument_id, side)`.
- New quote for same key marks old `BookRow` as `SUPERSEDED`.
- Best bid is highest active bid.
- Best ask is lowest active ask.
- Rows preserve received timestamp and processed timestamp.
- Active rows sort before superseded rows.
- Bids sort descending price.
- Asks sort ascending price.
- `QuoteEvent` remains immutable and status-free.

Verify:

```sh
cd apps/api && uv run pytest tests/test_book.py
```

Expected: all book tests pass.

### Step 5: Implement Application Pipeline

Create `apps/api/src/otc_to_book/application/pipeline.py`.

Pipeline should:

1. accept `RawMessage`.
2. emit message received event.
3. extract candidate.
4. convert no-candidate extraction errors into `QuoteRejected`.
5. validate candidate.
6. update book only for valid quote events.
7. return ordered event envelopes.

Keep this independent from FastAPI.

Every emitted event must use the envelope from `docs/architecture.md` with `event_id`, `event_type`, `schema_version`, `sequence`, `session_id`, `correlation_id`, `occurred_at`, and `payload`.

Verify:

```sh
cd apps/api && uv run pytest tests/test_pipeline.py
```

Expected: send valid message -> quote event + book update; send noise -> rejection, no book update.

### Step 6: Implement Simulator

Create `apps/api/src/otc_to_book/simulator/generator.py`.

Features:

- At least 5 valid message templates.
- Randomness 1 to 5.
- Noise rate.
- Deterministic seed support for tests.
- Broker ID field.
- Simulator session ID.
- Monotonic simulator tick sequence.

Verify:

```sh
cd apps/api && uv run pytest tests/test_simulator.py
```

Expected: deterministic seed produces stable output; noise rate can produce noise messages.

### Step 7: Implement FastAPI App And WebSocket

Create `apps/api/src/otc_to_book/api/main.py`.

Endpoints:

- `GET /health`
- `POST /samples/replay`
- `WebSocket /ws`

WebSocket handles:

- `user_message`
- `simulator_start`
- `simulator_stop`

WebSocket broadcasts:

- `message_received`
- `quote_parsed`
- `quote_rejected`
- `quote_event`
- `book_updated`

Keep event payloads explicit and stable.

`user_message` payload must include message text and may include broker ID. Server assigns message ID, receive timestamp, correlation ID, and sequence.

`simulator_start` payload must include randomness, noise rate, interval, optional seed, and broker set/default broker. Server responds through event envelopes.

`POST /samples/replay` must process rows in file order and attach `replay_id` plus 1-based `replay_sequence` to generated message payloads.

Verify:

```sh
cd apps/api && uv run pytest tests/test_api_ws.py
```

Expected: WebSocket smoke test sends user message and receives book update.

## Test Plan

Create tests:

- `tests/test_extraction.py`: 5 templates, compact price, accents, noise.
- `tests/test_validation.py`: each invalid field and valid candidate.
- `tests/test_book.py`: best bid/ask, stale replacement, timestamp preservation.
- `tests/test_pipeline.py`: full in-process pipeline.
- `tests/test_simulator.py`: templates, randomness, noise, seed.
- `tests/test_api_ws.py`: WebSocket smoke.
- `tests/test_event_contracts.py`: envelope shape, monotonic sequence, correlation ID preservation.
- `tests/test_sample_fixtures.py`: sample messages match expected outputs/rejections.

Prefer real tests. Do not mock domain logic.

## Done Criteria

- [ ] `cd apps/api && uv run pytest` passes.
- [ ] `cd apps/api && uv run ruff check .` passes.
- [ ] `cd apps/api && uv run ruff format --check .` passes.
- [ ] Domain logic imports without FastAPI.
- [ ] Event envelopes include schema version, sequence, session ID, correlation ID, and UTC timestamp.
- [ ] Extractor returns `ExtractionResult`; validation/application layer creates `QuoteRejected`.
- [ ] Sample fixture expected outputs are tested.
- [ ] WebSocket smoke test proves message -> quote -> book update.
- [ ] No future-phase features implemented.
- [ ] `tasks/todo.md` and `plans/README.md` mark Plan 002 DONE.

## STOP Conditions

Stop and report if:

- Plan 001 is not complete.
- Timestamp semantics become ambiguous.
- Extractor requires LLM/provider API to satisfy V1 examples.
- WebSocket API shape conflicts with frontend plan.
- Any step requires persistence or lifecycle events.

## Maintenance Notes

Reviewer should focus on Decimal usage, timezone-aware timestamps, replacement semantics, rejection reasons, and whether UI concerns leaked into domain code.
