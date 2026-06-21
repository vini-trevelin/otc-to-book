# Plan 001: Add deterministic ticker canonicalization

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving to the next step. If any
> STOP condition occurs, stop and report. When done, update the status row for
> this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 5859197..HEAD -- apps/api/src/otc_to_book/domain/extraction.py apps/api/src/otc_to_book/domain/models.py apps/api/tests/test_extraction.py apps/api/tests/test_book.py apps/api/tests/test_pipeline.py data/samples`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `5859197`, 2026-06-21

## Why this matters

The current backend accepts many one-character ticker variants as valid quotes
and then groups them as separate instruments. That fragments the book and hides
same-instrument quote replacement, which is the core product behavior. V1 should
stay deterministic: use a session-scoped valid ticker pool plus explicit
alias/canonical ticker map, not general fuzzy matching. Unknown valid-looking
tickers should become new valid session tickers, not be rejected or silently
merged by edit distance.

## Current state

- `apps/api/src/otc_to_book/domain/extraction.py` owns deterministic parsing and ticker normalization.
- `apps/api/src/otc_to_book/domain/book.py` groups book state by exact `QuoteEvent.instrument_id`.
- `apps/api/tests/test_extraction.py` covers supported templates but has no typo/canonicalization tests.
- `data/samples/v1_expected_quotes.jsonl` currently treats `PETR27` and `PETRO27` as distinct instruments.

Current code excerpts:

```python
# apps/api/src/otc_to_book/domain/extraction.py:40
def normalize_instrument(raw_ticker: str) -> str:
    return raw_ticker.strip().upper()
```

```python
# apps/api/src/otc_to_book/domain/book.py:20
def apply_quote(self, quote: QuoteEvent) -> BookState:
    rows = self._rows_by_instrument.setdefault(quote.instrument_id, [])
```

```python
# apps/api/src/otc_to_book/domain/extraction.py:57
ticker = r"(?P<ticker>[A-Za-z]{3,}[A-Za-z0-9]*\d{2})"
```

Observed probe before this plan:

```text
'vendo petro27 7.30 5mm' -> instrument=PETRO27
'vendo petr27 7.31 5mm' -> instrument=PETR27
'vendo petr027 7.32 5mm' -> instrument=PETR027
'vendo petrro27 7.33 5mm' -> instrument=PETRRO27
'vendo petroo27 7.34 5mm' -> instrument=PETROO27
'vendo petor27 7.35 5mm' -> instrument=PETOR27
BOOK KEYS ['PETOR27', 'PETR027', 'PETR27', 'PETRO27', 'PETROO27', 'PETRRO27']
```

Repo constraints to honor:

- V1 extraction is deterministic-first.
- Do not add a full instrument master in V1.
- Preserve both `raw_ticker` and normalized `instrument_id`.
- Business logic belongs in backend/domain layers.
- Every changed logic path needs tests.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Backend tests | `cd apps/api && uv run pytest` | exit 0; all tests pass |
| Targeted tests | `cd apps/api && uv run pytest tests/test_extraction.py tests/test_book.py tests/test_pipeline.py tests/test_sample_fixtures.py` | exit 0; all selected tests pass |
| Lint | `cd apps/api && uv run ruff check .` | exit 0; `All checks passed!` |
| Typecheck | `cd apps/api && uv run python -m compileall src tests` | exit 0 |
| Version pins | `node scripts/check-exact-versions.mjs` | exit 0 |

## Scope

**In scope**:

- `apps/api/src/otc_to_book/domain/extraction.py`
- `apps/api/src/otc_to_book/domain/models.py` only if a new rejection reason is needed
- `apps/api/tests/test_extraction.py`
- `apps/api/tests/test_book.py`
- `apps/api/tests/test_pipeline.py`
- `data/samples/v1_messages.*` and `data/samples/v1_expected_quotes.jsonl` only if adding small representative cases

**Out of scope**:

- General fuzzy matching or edit-distance matching.
- LLM extraction runtime behavior.
- Full instrument master, database, persistence, or external data lookup.
- Frontend changes.
- Changes to WebSocket envelope shape.

## Git workflow

- Branch: `codex/001-deterministic-ticker-canonicalization`
- Commit message example: `api: add deterministic ticker canonicalization`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Define the V1 canonical ticker policy

In `apps/api/src/otc_to_book/domain/extraction.py`, replace the trivial
`normalize_instrument()` implementation with explicit normalization helpers:

- lexical cleanup: strip, uppercase, remove internal whitespace only inside the ticker token if the parser begins accepting it;
- deterministic alias map, for example:

```python
CANONICAL_TICKER_ALIASES = {
    "PETROO27": "PETRO27",
    "PETRRO27": "PETRO27",
    "PETR027": "PETRO27",
}
```

Do not include `PETR27 -> PETRO27` unless the architect explicitly confirms that
`PETR27` is a typo rather than a real distinct fixture ticker. Current fixtures
expect `PETR27` to stay distinct.

Keep the function deterministic:

```python
class TickerResolver:
    def resolve(self, raw_ticker: str) -> str:
        normalized = normalize_instrument(raw_ticker)
        instrument_id = CANONICAL_TICKER_ALIASES.get(normalized, normalized)
        self._valid_tickers.add(instrument_id)
        return instrument_id
```

**Verify**: `cd apps/api && uv run pytest tests/test_extraction.py` -> tests pass after Step 2 adds coverage.

### Step 2: Add extraction tests for canonical aliases and non-aliases

In `apps/api/tests/test_extraction.py`, add parameterized cases that assert:

- `petro27`, `petroo27`, `petrro27`, and `petr027` produce `instrument_id == "PETRO27"` while preserving `raw_ticker`.
- `PETR27` remains `instrument_id == "PETR27"` unless the architect changed the policy.
- new valid-looking tickers such as `vale29` become new session-pool instruments.
- the valid ticker pool is scoped to the resolver/extractor instance.
- unsupported noise still returns `NO_QUOTE_DETECTED`.

Model the existing test style at `apps/api/tests/test_extraction.py:11`.

**Verify**: `cd apps/api && uv run pytest tests/test_extraction.py` -> all extraction tests pass.

### Step 3: Add book replacement regression coverage

In `apps/api/tests/test_book.py`, add a test that sends two quotes from the same
broker and side:

1. `bid petro27 7.25`
2. `bid petroo27 7.27`

Assert there is exactly one `PETRO27` book, two rows, and statuses are
`[ACTIVE, SUPERSEDED]`. This proves canonical aliases use the same active book key.

Also assert no `PETROO27` key exists.

**Verify**: `cd apps/api && uv run pytest tests/test_book.py` -> all book tests pass.

### Step 4: Add pipeline-level regression coverage

In `apps/api/tests/test_pipeline.py`, add a test that processes the same typo
variant through `QuotePipeline` and checks the final `book_updated` payload has
only the canonical key. This protects the API event path without changing the
envelope contract.

**Verify**: `cd apps/api && uv run pytest tests/test_pipeline.py` -> all pipeline tests pass.

### Step 5: Update sample fixtures only if needed

If adding sample rows for typo aliases, keep them minimal and update both:

- `data/samples/v1_messages.jsonl`
- `data/samples/v1_expected_quotes.jsonl`

Do not rewrite existing sample IDs. Do not change `sample-002` unless the
architect confirms `PETR27` is supposed to canonicalize to `PETRO27`.

**Verify**: `cd apps/api && uv run pytest tests/test_sample_fixtures.py` -> fixture tests pass.

## Test plan

- Unit tests in `test_extraction.py` for alias map behavior and raw ticker preservation.
- Domain tests in `test_book.py` for active replacement under canonical aliases.
- Pipeline test in `test_pipeline.py` for event payload behavior.
- Existing sample fixture test remains passing.

## Done criteria

- [ ] `cd apps/api && uv run pytest` exits 0.
- [ ] `cd apps/api && uv run ruff check .` exits 0.
- [ ] `cd apps/api && uv run python -m compileall src tests` exits 0.
- [ ] `node scripts/check-exact-versions.mjs` exits 0.
- [ ] `PETROO27`, `PETRRO27`, and `PETR027` no longer create separate book keys when configured as aliases.
- [ ] Unknown valid-looking tickers such as `VALE29` become new session-pool instruments.
- [ ] `raw_ticker` still preserves the original extracted ticker text.
- [ ] No files outside the in-scope list are modified except `plans/README.md` status.

## STOP conditions

Stop and report if:

- The architect says `PETR27` must canonicalize to `PETRO27`; that conflicts with current sample fixtures and needs a fixture policy decision.
- The fix appears to require fuzzy matching, LLM calls, persistence, or a full instrument master.
- WebSocket envelope fields must change.
- The drift check shows in-scope files changed and excerpts no longer match.

## Maintenance notes

Reviewers should scrutinize false merges. The alias map should be small, explicit,
and covered by tests. Future fuzzy or LLM extraction should not bypass this
canonical `instrument_id` policy; it should produce candidates that still flow
through deterministic validation and book construction.
