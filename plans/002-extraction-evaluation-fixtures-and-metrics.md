# Plan 002: Add extraction evaluation fixtures and metrics

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving to the next step. If any
> STOP condition occurs, stop and report. When done, update the status row for
> this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 5859197..HEAD -- apps/api/src/otc_to_book apps/api/tests data/samples docs/roadmap.md`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/001-deterministic-ticker-canonicalization.md`
- **Category**: tests
- **Planned at**: commit `5859197`, 2026-06-21

## Why this matters

The next backend work is parser quality and performance. Before adding more
normalization, fuzzy matching, or LLM fallback, the repo needs a cheap benchmark
that reports extraction quality on known examples. This keeps future parser
changes evidence-based and guards against false ticker merges.

## Current state

- `data/samples/v1_expected_quotes.jsonl` stores expected extraction fields.
- `apps/api/tests/test_sample_fixtures.py` loops through expected rows and asserts exact outputs.
- `docs/roadmap.md` already names Phase 5 as an evaluation dataset, but there is no metrics command or report.

Current test excerpt:

```python
# apps/api/tests/test_sample_fixtures.py:26
for expected in expected_rows:
    message = messages[expected["message_id"]]
    raw = RawMessage(**message)
    result = extractor.extract(raw)
```

Current roadmap excerpt:

```text
# docs/roadmap.md
## Phase 5: Evaluation Dataset

Create benchmark datasets:

- message.
- expected quote.

Measure:

- ticker accuracy.
- side accuracy.
- quantity accuracy.
- price accuracy.
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Backend tests | `cd apps/api && uv run pytest` | exit 0; all tests pass |
| Targeted tests | `cd apps/api && uv run pytest tests/test_sample_fixtures.py` | exit 0 |
| Metrics script | `cd apps/api && uv run python scripts/evaluate_extraction.py` | exit 0; prints metrics |
| Lint | `cd apps/api && uv run ruff check .` | exit 0 |
| Typecheck | `cd apps/api && uv run python -m compileall src tests scripts` | exit 0 |

## Scope

**In scope**:

- `apps/api/scripts/evaluate_extraction.py` or `scripts/evaluate_extraction.py` if repo convention favors root scripts.
- `apps/api/tests/test_sample_fixtures.py`
- `apps/api/tests/test_extraction_metrics.py` (create if useful)
- `data/samples/v1_messages.jsonl`
- `data/samples/v1_expected_quotes.jsonl`
- `docs/roadmap.md` only to note that a V1-lite evaluation harness now exists and Phase 5 remains a larger dataset effort.

**Out of scope**:

- Parser behavior changes beyond fixtures needed after plan 001.
- Fuzzy matching.
- LLM calls or provider dependencies.
- New unpinned dependencies.

## Git workflow

- Branch: `codex/002-extraction-evaluation-metrics`
- Commit message example: `api: add extraction evaluation metrics`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Define metric fields

Create a small pure-Python evaluator that reads:

- `data/samples/v1_messages.jsonl`
- `data/samples/v1_expected_quotes.jsonl`

It should run `DeterministicQuoteExtractor` and compute:

- total examples
- quote examples
- rejection examples
- ticker accuracy for quote examples
- side accuracy
- quote value accuracy
- quantity accuracy
- rejection reason accuracy
- exact row accuracy

Use only Python standard library and existing domain code. Do not add dependencies.

**Verify**: `cd apps/api && uv run python scripts/evaluate_extraction.py` -> prints metrics and exits 0.

### Step 2: Add regression fixture rows for canonical ticker behavior

Add a few rows that represent plan 001 behavior, for example:

- `vendo petroo27 7.30 5mm` -> `instrument_id: PETRO27`
- `bid petrro27 7.25` -> `instrument_id: PETRO27`
- `vendo petr027 7.31 4mm` -> `instrument_id: PETRO27`
- `PETR27 OFFER 7.30 SIZE 5` -> `instrument_id: PETR27` if still decided as distinct

Keep fixtures small. The goal is a smoke benchmark, not the full Phase 5 dataset.

**Verify**: `cd apps/api && uv run pytest tests/test_sample_fixtures.py` -> all fixture tests pass.

### Step 3: Test the evaluator output

Add `apps/api/tests/test_extraction_metrics.py` or extend
`test_sample_fixtures.py` with tests that assert the evaluator returns:

- `exact_row_accuracy == Decimal("1")` or equivalent integer numerator/denominator for the current fixture set.
- ticker accuracy counts include the new canonical alias rows.
- rejection reason accuracy includes existing noise messages.

Prefer integer counts over floats. If percentages are printed, format them from
integer counts at the edge.

**Verify**: `cd apps/api && uv run pytest tests/test_sample_fixtures.py tests/test_extraction_metrics.py` -> all pass.

### Step 4: Add a package script if consistent

If the repo convention supports it, add an API package script in
`apps/api/package.json`:

```json
"eval:extraction": "uv run python scripts/evaluate_extraction.py"
```

Only do this if the script path is under `apps/api/scripts`. Keep dependencies pinned
and do not change package manager versions.

**Verify**: `pnpm --filter api eval:extraction` -> exits 0 and prints metrics.

### Step 5: Update roadmap wording

Update `docs/roadmap.md` narrowly:

- Add a note under V1 or Phase 5 that a small deterministic extraction evaluation
  harness exists.
- Keep Phase 5 as the larger benchmark dataset and reporting effort.
- Mention that fuzzy/LLM extraction must be gated by these metrics.

Do not expand roadmap into implementation details; link or point to the script.

**Verify**: `rg -n "evaluation|LLM|fuzzy|metrics" docs/roadmap.md` -> shows the new concise note.

## Test plan

- Existing fixture tests remain passing.
- New evaluator unit tests cover exact counts.
- Full backend tests run after all changes.

## Done criteria

- [ ] `cd apps/api && uv run pytest` exits 0.
- [ ] `cd apps/api && uv run ruff check .` exits 0.
- [ ] `cd apps/api && uv run python -m compileall src tests scripts` exits 0, adjusted if script lives at repo root.
- [ ] Evaluation command exits 0 and reports all current fixture rows as correct.
- [ ] New fixture rows cover deterministic canonical aliases.
- [ ] `docs/roadmap.md` mentions metric gating for fuzzy/LLM extraction.

## STOP conditions

Stop and report if:

- Plan 001 has not landed or canonical ticker policy is still unresolved.
- The evaluator needs non-standard dependencies.
- The fixture set exposes an existing parser failure unrelated to ticker aliases.
- The roadmap update would require changing project direction rather than documenting the agreed gate.

## Maintenance notes

Future parser changes should update fixtures and evaluator expectations in the
same PR. Keep the evaluator deterministic and fast enough for local use. If the
dataset grows large later, add a separate slow benchmark marker instead of
slowing the default unit suite.
