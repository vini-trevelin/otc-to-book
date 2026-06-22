# Plan 003: Design fast fuzzy and LLM extraction fallback

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving to the next step. If any
> STOP condition occurs, stop and report. When done, update the status row for
> this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 5859197..HEAD -- docs/architecture.md docs/extraction-strategy.md docs/roadmap.md apps/api/src/otc_to_book/domain/extraction.py apps/api/src/otc_to_book/application/pipeline.py apps/api/tests`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/002-extraction-evaluation-fixtures-and-metrics.md`
- **Category**: direction
- **Planned at**: commit `5859197`, 2026-06-21

## Why this matters

The user wants fast fuzzy/LLM extraction on the roadmap, but not as uncontrolled
runtime behavior in the current deterministic V1. The right next step is a
design/spike plan: define the fallback order, latency budget, confidence gates,
metrics, and observability before any provider or fuzzy algorithm is added.
This lets future work improve recall on noisy chat while protecting ticker
precision and book correctness.

## Current state

- `docs/extraction-strategy.md` says V1 is deterministic-first and future adapters may include `LLMQuoteExtractor`, `BrokerSpecificQuoteExtractor`, and `HybridQuoteExtractor`.
- `apps/api/src/otc_to_book/domain/extraction.py` already defines a `QuoteExtractor` protocol.
- `apps/api/src/otc_to_book/application/pipeline.py` receives a `QuoteExtractor`, so fallback composition can be added behind that interface later.

Current excerpts:

```python
# apps/api/src/otc_to_book/domain/extraction.py:22
class QuoteExtractor(Protocol):
    def extract(self, raw_message: RawMessage) -> ExtractionResult: ...
```

```python
# apps/api/src/otc_to_book/application/pipeline.py:29
extractor: QuoteExtractor | None = None,
...
self.extractor = extractor or DeterministicQuoteExtractor()
```

```text
# docs/extraction-strategy.md
Future adapters:

- LLMQuoteExtractor
- BrokerSpecificQuoteExtractor
- HybridQuoteExtractor
```

Design constraints:

- V1 runtime remains deterministic unless an implementation plan explicitly changes it.
- Business logic remains backend/domain.
- Raw ticker and canonical instrument ID must both be preserved.
- No unpinned dependencies.
- No network/provider side effects during normal tests.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Docs search | `rg -n "LLM|fuzzy|fallback|evaluation|deterministic" docs plans apps/api/src` | shows consistent terminology |
| Backend tests | `cd apps/api && uv run pytest` | exit 0 |
| Lint | `cd apps/api && uv run ruff check .` | exit 0 |
| Typecheck | `cd apps/api && uv run python -m compileall src tests` | exit 0 |

## Scope

**In scope**:

- `docs/extraction-strategy.md`
- `docs/roadmap.md`
- `docs/architecture.md` only if a short architecture note is needed
- `plans/README.md` status
- Optionally a new design doc under `docs/decisions/0005-fast-fuzzy-llm-fallback.md` if the architect wants this formalized as an ADR

**Out of scope**:

- Implementing fuzzy matching.
- Implementing LLM calls.
- Adding provider SDKs, credentials, environment variables, or network calls.
- Changing production runtime behavior.
- Adding a database, queue, or full instrument master.

## Git workflow

- Branch: `codex/003-fast-fuzzy-llm-extraction-design`
- Commit message example: `docs: design fuzzy llm extraction fallback`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Document the target fallback pipeline

Update `docs/extraction-strategy.md` with a future pipeline that remains behind
the `QuoteExtractor` interface:

```text
RawMessage
  -> DeterministicTemplateExtractor
  -> DeterministicTickerCanonicalizer
  -> SessionValidTickerPool
  -> FastFuzzyCandidateExtractor (future, local, bounded)
  -> LLMQuoteExtractor (future, optional fallback)
  -> QuoteValidator
  -> BookBuilder
```

Make clear that the current implementation still stops after deterministic
extraction and canonicalization.

**Verify**: `rg -n "FastFuzzyCandidateExtractor|LLMQuoteExtractor|QuoteExtractor" docs/extraction-strategy.md` -> all terms appear.

### Step 2: Define fallback gates

Document these gates:

- Deterministic parser always runs first.
- Fast fuzzy extractor only runs when deterministic parser returns `NO_QUOTE_DETECTED` or a candidate with a known recoverable ticker issue.
- Fuzzy extractor can propose candidates only from a bounded canonical ticker universe or alias map; no open-ended edit-distance merge into the book.
- LLM fallback only runs after deterministic and fuzzy stages fail or produce low confidence.
- Every fallback result must produce `raw_ticker`, `instrument_id`, `extraction_method`, `template_id` or fallback trace, `confidence`, and rejection reasons.
- The validator remains the final gate before book updates.

**Verify**: `rg -n "confidence|validator|NO_QUOTE_DETECTED|canonical" docs/extraction-strategy.md` -> gates are documented.

### Step 3: Define performance and safety budgets

Add target budgets as design constraints, not hard-coded runtime values:

- Deterministic path: sub-millisecond per message under normal local test conditions.
- Fast fuzzy path: bounded local work, no network, expected single-digit milliseconds per message.
- LLM path: asynchronous or explicitly opt-in; never blocks the default deterministic path without a timeout and metrics.
- All stages must emit enough diagnostic data to measure false accepts and false rejects.

Do not add implementation details that require a specific provider.

**Verify**: `rg -n "latency|milliseconds|timeout|metrics|network" docs/extraction-strategy.md docs/roadmap.md` -> performance gates are visible.

### Step 4: Update roadmap

Update `docs/roadmap.md` to include a staged backend-performance roadmap:

1. V1.1: deterministic ticker alias/canonicalization plus regression tests.
2. V1.2: extraction evaluation harness and fixture metrics.
3. Phase 2/3 candidate: fast local fuzzy candidate extraction behind metrics.
4. Later phase: optional LLM fallback after benchmark and observability gates.

Keep the roadmap concise. Do not turn it into a long architecture document.

**Verify**: `rg -n "V1.1|V1.2|fuzzy|LLM|metrics" docs/roadmap.md` -> staged roadmap appears.

### Step 5: Decide whether to write an ADR

If the architect wants this as a formal decision, create
`docs/decisions/0005-fast-fuzzy-llm-fallback.md` with:

- Status: Proposed, not Accepted, unless architect explicitly accepts it.
- Context: deterministic V1 is accurate but misses noisy typos.
- Decision: future fallback must be staged, measured, and gated.
- Consequences: added complexity, possible provider latency/cost, improved recall after metrics exist.

If no ADR is desired, skip this step and keep the design in roadmap/extraction docs.

**Verify**: `rg -n "Status|Proposed|fallback|metrics" docs/decisions/0005-fast-fuzzy-llm-fallback.md` -> only if ADR is created.

## Test plan

This is a design/documentation plan. It should not change runtime code. Verification is:

- docs contain the staged design;
- backend tests still pass, proving no runtime behavior changed;
- no provider dependency, credential, or network behavior was added.

## Done criteria

- [ ] `docs/extraction-strategy.md` describes deterministic -> canonical -> future fuzzy -> future LLM fallback.
- [ ] `docs/roadmap.md` lists staged backend performance/extraction work.
- [ ] No runtime source code behavior changes.
- [ ] No provider SDK, secret, environment variable, or dependency added.
- [ ] `cd apps/api && uv run pytest` exits 0.
- [ ] `cd apps/api && uv run ruff check .` exits 0.
- [ ] `cd apps/api && uv run python -m compileall src tests` exits 0.

## STOP conditions

Stop and report if:

- The architect wants immediate runtime LLM/fuzzy implementation instead of design.
- The design requires external provider selection, credentials, or cost-bearing network calls.
- The docs conflict with ADR 0001 deterministic V1 behavior.
- Updating docs requires changing product scope beyond extraction quality and backend performance.

## Maintenance notes

Future implementation should start with local fuzzy candidate extraction, not LLM
fallback. The review focus should be false positive control: a wrong ticker merge
is worse than a visible rejection because it corrupts the book. LLM output must be
validated and benchmarked like any other extractor output.
