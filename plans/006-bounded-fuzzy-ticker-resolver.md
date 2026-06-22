# Plan 006: Implement bounded fuzzy ticker resolver

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving to the next step. If any
> STOP condition occurs, stop and report. When done, update the status row for
> this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 5d18b0d..HEAD -- apps/api/src/otc_to_book apps/api/tests data/samples docs plans`
> If plan 005 has not landed, stop. If in-scope files changed after plan 005,
> compare this plan against the live code and update the plan before executing.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: `plans/005-chaotic-extraction-evaluation-and-simulator.md`
- **Category**: bug
- **Planned at**: commit `5d18b0d`, 2026-06-22

## Why this matters

The session valid ticker pool currently learns unknown valid-looking tickers but
only collapses explicit aliases. Bounded fuzzy matching should recover obvious
near-duplicate tickers after a canonical ticker exists in the session, without
merging legitimately distinct instruments. The primary risk is false positives:
a wrong merge corrupts the book more severely than a missed correction.

## Current state

- `TickerResolver.resolve()` normalizes, applies explicit aliases, adds the result to `_valid_tickers`, and returns it.
- There is no fuzzy matching.
- `PETR27` is intentionally distinct from `PETRO27`.
- Plan 005 should add hard-negative fixtures and false-merge metrics before this plan runs.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Backend tests | `cd apps/api && uv run pytest` | exit 0 |
| Targeted tests | `cd apps/api && uv run pytest tests/test_extraction.py tests/test_extraction_metrics.py tests/test_book.py tests/test_pipeline.py` | exit 0 |
| Eval command | `pnpm --filter api eval:extraction` | exits 0; false merges remain 0 |
| Lint | `cd apps/api && uv run ruff check .` | exit 0 |
| Typecheck | `cd apps/api && uv run python -m compileall src tests scripts` | exit 0 |
| Exact versions | `node scripts/check-exact-versions.mjs` | exit 0 |

## Scope

**In scope**:

- `apps/api/src/otc_to_book/domain/extraction.py`
- `apps/api/tests/test_extraction.py`
- `apps/api/tests/test_book.py`
- `apps/api/tests/test_pipeline.py`
- `apps/api/tests/test_extraction_metrics.py`
- `data/samples/v1_messages.jsonl`
- `data/samples/v1_expected_quotes.jsonl`
- `docs/extraction-strategy.md`
- `docs/roadmap.md`

**Out of scope**:

- LLM/provider runtime behavior.
- Persistence or full instrument master.
- Frontend changes.
- Fuzzy matching outside ticker resolution.
- New dependencies.
- Changing parser template coverage except for fixtures explicitly covered by plan 005.

## Git workflow

- Branch: `feat/fuzzy_extraction_implementation`
- Commit message example: `api: implement bounded fuzzy resolver`
- Do not push or open a PR unless the operator instructed it.

## Algorithm

Implement fuzzy matching inside `TickerResolver`, after explicit aliases and
before adding a new valid ticker.

Definitions:

- normalized ticker: uppercase raw ticker from `normalize_instrument`;
- alpha root: leading alphabetic prefix before the numeric suffix;
- numeric suffix: trailing digits at the end of the ticker.

Resolution order:

1. Normalize raw ticker.
2. Apply explicit alias map. If alias exists, return aliased canonical instrument and add it to the valid pool.
3. If normalized ticker already exists in valid pool, return it.
4. If no existing pool ticker is eligible for fuzzy matching, add normalized ticker as a new valid ticker and return it.
5. If exactly one eligible fuzzy match exists, return that existing pool ticker.
6. If zero or more than one eligible match exists, add normalized ticker as a new valid ticker and return it.

Eligibility rule:

- numeric suffix must match exactly;
- alpha roots must be length `>= 4`;
- Levenshtein edit distance between alpha roots must be exactly `1`;
- normalized ticker must not be in `FUZZY_EXCLUSION_TICKERS`;
- existing pool ticker must not be in `FUZZY_EXCLUSION_TICKERS`;
- the normalized ticker must not already be an explicit canonical ticker distinct from the candidate.

Initial exclusions:

```python
FUZZY_EXCLUSION_TICKERS = {"PETR27"}
```

Initial intended fuzzy positives after pool contains `PETRO27`:

- `PETOR27` -> `PETRO27`
- at least one non-Petrobras fuzzy-positive case selected from plan 005 chaos fixtures, only if false-merge metrics prove it safe

Initial intended non-merges:

- `PETR27` remains `PETR27`
- `BOVE26` does not merge to `BOVA26` until explicitly approved
- any ticker with a different numeric suffix does not merge
- ambiguous one-edit matches do not merge

Do not expose fuzzy confidence in the domain model in this plan. Preserve current
`QuoteCandidate` shape and `confidence=0.95`; observability can be expanded later.

## Steps

### Step 1: Add pure helper functions

In `apps/api/src/otc_to_book/domain/extraction.py`, add small pure helpers:

- split normalized ticker into `(alpha_root, numeric_suffix)`;
- compute Levenshtein distance for short strings without dependencies;
- return eligible fuzzy candidates from `valid_tickers`.

Keep helpers private unless tests need direct import. Prefer testing through
`TickerResolver.resolve()`.

**Verify**: `cd apps/api && uv run pytest tests/test_extraction.py` -> helper behavior covered through resolver tests.

### Step 2: Extend `TickerResolver`

Add optional constructor fields with defaults:

```python
enable_fuzzy: bool = True
fuzzy_exclusions: set[str] | None = None
```

Keep `enable_fuzzy=True` only if plan 005 hard-negative metrics are present.
If the team wants a slower rollout, set default `False` and enable it in
`DeterministicQuoteExtractor`; choose one default and encode it in tests.

Recommended default for this plan: `enable_fuzzy=True`, because plan 006 is the
explicit implementation branch.

**Verify**: resolver tests cover enabled and disabled behavior.

### Step 3: Add resolver tests

In `tests/test_extraction.py`, add tests:

- after resolving `petro27`, resolving `petor27` returns `PETRO27`;
- resolving `petor27` before `petro27` creates `PETOR27`;
- `PETR27` never merges into `PETRO27`;
- different suffix does not merge;
- ambiguous candidates do not merge;
- explicit aliases still win before fuzzy;
- `enable_fuzzy=False` preserves current session-pool behavior.

**Verify**: `cd apps/api && uv run pytest tests/test_extraction.py` -> all pass.

### Step 4: Add book and pipeline regression tests

Add tests that prove:

- fuzzy alias after canonical quote uses the existing `PETRO27` book key;
- fuzzy alias before canonical quote becomes its own book key;
- hard-negative examples remain separate book keys;
- `quote_parsed` and `quote_event` preserve raw ticker while using resolved `instrument_id`.

**Verify**: `cd apps/api && uv run pytest tests/test_book.py tests/test_pipeline.py` -> all pass.

### Step 5: Extend evaluator fixtures

Add fixture rows for:

- positive fuzzy correction: `petor27` after a prior `PETRO27` fixture in the same evaluator run -> `PETRO27`;
- one non-Petrobras positive fuzzy correction only if plan 005 introduced a clear expected pair;
- hard negative `PETR27` -> `PETR27`;
- hard negative `BOVE26` with `forbidden_instrument_id: BOVA26`;
- different suffix non-merge.

The evaluator processes rows in file order, so place fuzzy-positive rows after
the canonical ticker has appeared.

**Verify**: `pnpm --filter api eval:extraction` -> aggregate exact accuracy is 100% and false merges are 0.

### Step 6: Update docs

Update `docs/extraction-strategy.md`:

- define bounded fuzzy resolution order;
- document same-suffix, one-edit, exclusion, and ambiguity rules;
- explicitly state `PETR27` remains excluded.

Update `docs/roadmap.md`:

- mark V1.2 as bounded fuzzy implementation after chaotic evaluation.
- keep LLM/provider behavior deferred.

**Verify**: `rg -n "FUZZY|same suffix|PETR27|false-merge|bounded fuzzy" docs plans apps/api/src` -> rules are findable.

## Test plan

- Resolver tests cover all matching and non-matching branches.
- Book/pipeline tests prove fuzzy output affects book keys correctly.
- Evaluation fixtures prove zero false merges.
- Full backend tests prove no regression.

## Done criteria

- [ ] Plan 005 is DONE.
- [ ] `PETOR27` resolves to `PETRO27` only after `PETRO27` is already in the session pool.
- [ ] At least one non-Petrobras fuzzy fixture is handled according to the plan 005 expectation, or explicitly deferred in `plans/README.md` with rationale.
- [ ] `PETR27` remains distinct from `PETRO27`.
- [ ] Different suffixes never fuzzy-merge.
- [ ] Ambiguous candidates never fuzzy-merge.
- [ ] Explicit aliases still take precedence.
- [ ] `pnpm --filter api eval:extraction` reports exact accuracy 100% and false merges 0.
- [ ] `cd apps/api && uv run pytest` exits 0.
- [ ] `cd apps/api && uv run ruff check .` exits 0.
- [ ] `cd apps/api && uv run python -m compileall src tests scripts` exits 0.
- [ ] `node scripts/check-exact-versions.mjs` exits 0.
- [ ] `plans/README.md` status for plan 006 is updated.

## STOP conditions

Stop and report if:

- plan 005 false-merge metrics are missing;
- a positive fuzzy correction cannot be expressed without increasing false merges;
- multiple valid pool candidates are equally close;
- any hard-negative fixture begins resolving to a forbidden instrument;
- the implementation requires a dependency or persistent instrument master.

## Maintenance notes

Fuzzy matching must remain conservative. Future improvements should prefer more
fixtures and broker-specific aliases before loosening the algorithm. Reviewers
should treat zero false merges as a release gate.
