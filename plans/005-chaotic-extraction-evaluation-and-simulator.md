# Plan 005: Add chaotic extraction evaluation and simulator inputs

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving to the next step. If any
> STOP condition occurs, stop and report. When done, update the status row for
> this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 5d18b0d..HEAD -- apps/api/src/otc_to_book apps/api/tests data/samples docs plans`
> If any in-scope file changed since this plan was written, compare the current
> excerpts and tests against live code before proceeding.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: completed plan 002 (extraction evaluation fixtures and metrics, merged in PR #2)
- **Category**: tests
- **Planned at**: commit `5d18b0d`, 2026-06-22

## Why this matters

The current parser benchmark is too clean to support fuzzy extraction safely.
Before implementing fuzzy matching, the repo needs chaotic positive examples and
hard negative examples that expose false merges. The simulator should also be
able to generate controlled chaos so manual UI testing and future automated
benchmarks exercise realistic broker-chat messiness.

## Current state

- `apps/api/src/otc_to_book/simulator/generator.py` emits only supported clean templates plus four noise messages.
- `data/samples/v1_expected_quotes.jsonl` has 14 rows and no explicit false-merge negative cases.
- `apps/api/src/otc_to_book/application/evaluation.py` reports aggregate ticker, side, quote value, quantity, rejection reason, and exact-row accuracy, but not false-merge categories.
- `TickerResolver` currently uses explicit aliases only: `PETROO27`, `PETRRO27`, `PETR027` -> `PETRO27`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Backend tests | `cd apps/api && uv run pytest` | exit 0 |
| Targeted tests | `cd apps/api && uv run pytest tests/test_simulator.py tests/test_extraction.py tests/test_extraction_metrics.py tests/test_sample_fixtures.py` | exit 0 |
| Eval command | `pnpm --filter api eval:extraction` | exits 0 and reports expected counts |
| Lint | `cd apps/api && uv run ruff check .` | exit 0 |
| Typecheck | `cd apps/api && uv run python -m compileall src tests scripts` | exit 0 |
| Exact versions | `node scripts/check-exact-versions.mjs` | exit 0 |

## Scope

**In scope**:

- `apps/api/src/otc_to_book/simulator/generator.py`
- `apps/api/src/otc_to_book/application/evaluation.py`
- `apps/api/tests/test_simulator.py`
- `apps/api/tests/test_extraction.py`
- `apps/api/tests/test_extraction_metrics.py`
- `apps/api/tests/test_sample_fixtures.py`
- `data/samples/v1_messages.jsonl`
- `data/samples/v1_expected_quotes.jsonl`
- `docs/extraction-strategy.md`
- `docs/roadmap.md`

**Out of scope**:

- Implementing fuzzy matching.
- Changing book active-key rules.
- Adding LLM/provider runtime behavior.
- Adding dependencies.
- Persisting the valid ticker pool.
- Frontend UI changes.

## Git workflow

- Branch: `feat/fuzzy_extraction_implementation`
- Commit message example: `api: plan fuzzy extraction`
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add chaotic fixture rows

Extend `data/samples/v1_messages.jsonl` and `data/samples/v1_expected_quotes.jsonl`
with a balanced set of new rows. Keep current rows unchanged.

Add positive chaotic rows that should still parse under deterministic rules:

- extra whitespace: `vendo   petro27   7.30   5mm` -> `PETRO27`
- comma decimal: `vendo petro27 7,30 5mm` -> `PETRO27`, value `7.30`
- uppercase/lowercase mixed template: `pEtRo27 offer 7.31 size 4` -> `PETRO27`
- accent: `tomo petro27 até 7.26` -> `PETRO27`
- explicit alias variants already supported: `petroo27`, `petrro27`, `petr027` -> `PETRO27`

Add hard negative rows that must not false-merge:

- `PETR27 OFFER 7.31 SIZE 4` remains `PETR27`
- `vendo petor27 7.30 5mm` remains `PETOR27` until explicitly decided otherwise
- `vendo bova26 7.30 5mm` remains `BOVA26`
- `vendo bove26 7.30 5mm` remains `BOVE26` or is rejected by later fuzzy rules unless explicitly mapped; it must not silently merge in this plan

Add rejection rows:

- `vendo petro 27 7.30 5mm` -> `NO_QUOTE_DETECTED`
- `vendo petro27 mercado firme` -> `NO_QUOTE_DETECTED`
- `petro27 7.30 5mm maybe` -> `NO_QUOTE_DETECTED`

**Verify**: `cd apps/api && uv run pytest tests/test_sample_fixtures.py` -> all fixture rows pass.

### Step 2: Expand evaluator categories

Update `ExtractionEvaluation` to include integer-count categories:

- `clean_exact`
- `chaotic_positive_exact`
- `hard_negative_exact`
- `rejection_exact`
- `false_merge`

Represent category membership in expected fixture rows with a new optional field:

```json
{"message_id":"sample-015","expected_type":"quote","category":"chaotic_positive", ...}
```

Rules:

- Existing rows default to category `clean`.
- `false_merge.total` counts hard-negative quote rows.
- `false_merge.correct` means the candidate did **not** resolve to the forbidden instrument.
- Add optional `forbidden_instrument_id` to hard-negative rows when needed, e.g. `PETOR27` must not resolve to `PETRO27`.
- Continue to report existing aggregate metrics so current command output remains useful.

**Verify**: `cd apps/api && uv run pytest tests/test_extraction_metrics.py` -> evaluator category counts are asserted.

### Step 3: Add simulator chaos config

Extend `SimulatorConfig` with deterministic, bounded chaos controls:

```python
chaos_rate: float = 0
ticker_typo_rate: float = 0
template_noise_rate: float = 0
```

Validation:

- each rate must be between `0` and `1`;
- default values preserve current simulator behavior;
- seeded simulator output remains deterministic.

`ChatMessageGenerator` should apply chaos only to generated quote messages, not
noise messages. Add helpers that can:

- change ticker casing;
- apply explicit alias typo variants for `petro27`;
- add extra whitespace between tokens;
- switch decimal `.` to `,`;
- add common harmless punctuation only if the deterministic parser already supports or the fixture expectation is rejection.

Do not add fuzzy-only examples to quote simulation unless they are expected to
reject or remain separate before plan 006.

**Verify**: `cd apps/api && uv run pytest tests/test_simulator.py` -> deterministic seed and chaos tests pass.

### Step 4: Add simulator tests

Add tests for:

- defaults preserve current behavior shape;
- invalid chaos rates raise `ValueError`;
- same seed + same chaos config emits the same sequence;
- `chaos_rate=1`, `ticker_typo_rate=1`, and a known seed emits at least one known alias or chaotic ticker form;
- `noise_rate=1` still emits only noise messages even when chaos rates are nonzero.

Avoid tests that depend on broad randomness. Use a fixed seed and a small bounded
loop, or test private helper behavior if helper methods are deterministic.

**Verify**: `cd apps/api && uv run pytest tests/test_simulator.py` -> all simulator tests pass.

### Step 5: Update docs

Update `docs/extraction-strategy.md` and `docs/roadmap.md`:

- V1.2 starts with chaotic evaluation and simulator coverage before fuzzy matching;
- hard-negative false-merge metrics are required before implementing fuzzy resolver changes;
- simulator chaos is controlled and deterministic under seed.

**Verify**: `rg -n "chaotic|false-merge|chaos_rate|hard negative" docs plans` -> docs include the new gates.

## Test plan

- Fixture tests prove chaotic rows and hard negatives are encoded correctly.
- Evaluator tests prove category counts and false-merge counts are computed.
- Simulator tests prove chaos controls are deterministic and default-safe.
- Full backend tests prove no runtime regressions.

## Done criteria

- [ ] Existing clean fixture rows still pass.
- [ ] New chaotic positive rows pass.
- [ ] New hard-negative rows do not false-merge.
- [ ] Evaluator prints aggregate metrics and category metrics.
- [ ] Simulator chaos defaults to off.
- [ ] Simulator chaos is deterministic under seed.
- [ ] `cd apps/api && uv run pytest` exits 0.
- [ ] `cd apps/api && uv run ruff check .` exits 0.
- [ ] `cd apps/api && uv run python -m compileall src tests scripts` exits 0.
- [ ] `pnpm --filter api eval:extraction` exits 0.
- [ ] `node scripts/check-exact-versions.mjs` exits 0.
- [ ] `plans/README.md` status for plan 005 is updated.

## STOP conditions

Stop and report if:

- chaotic fixture rows require fuzzy matching to pass;
- simulator chaos changes default simulator output;
- the evaluator cannot distinguish hard-negative false merges;
- a fix requires new dependencies;
- the work appears to need persistent storage or a full instrument master.

## Maintenance notes

Plan 005 is the guardrail for plan 006. Do not implement fuzzy matching until
false-merge metrics exist and hard-negative fixtures are in place. Future reviews
should treat any increase in false merges as a higher-severity regression than a
missed fuzzy correction.
