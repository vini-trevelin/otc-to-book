# Plan 004: Design backend-owned extraction provider config

> **Executor instructions**: Follow this plan step by step. Run every verification
> command and confirm the expected result before moving to the next step. If any
> STOP condition occurs, stop and report. When done, update the status row for
> this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 5859197..HEAD -- docs/architecture.md docs/extraction-strategy.md docs/frontend.md docs/roadmap.md apps/api/src/otc_to_book apps/web`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/003-fast-fuzzy-llm-extraction-fallback.md`
- **Category**: direction
- **Planned at**: commit `5859197`, 2026-06-21

## Why this matters

Fast fuzzy and LLM extraction can improve recall on noisy OTC chat, but provider
configuration must not move domain logic or secrets into the browser. The
dashboard may expose controls, but the backend must own API keys, model server
allowlists, timeouts, validation, and book update authority. This plan designs
that control-plane split before any runtime LLM/Ollama implementation is built.

## Current state

- `docs/architecture.md` says the backend owns extraction, validation, book state, and event broadcasting.
- `docs/frontend.md` says the frontend owns controls and rendering while domain decisions remain in the backend.
- `apps/api/src/otc_to_book/application/pipeline.py` injects a `QuoteExtractor`, so provider-backed extractors can remain behind the same interface later.
- `docs/extraction-strategy.md` names future `LLMQuoteExtractor` and `HybridQuoteExtractor` adapters but does not define provider configuration ownership.

Current excerpts:

```text
# docs/architecture.md
The backend owns:

- Message ingestion.
- Auto simulator.
- Sample replay parsing.
- Extraction.
- Validation.
- Book state.
- Event broadcasting.
```

```text
# docs/frontend.md
Frontend consumes backend WebSocket events and keeps local UI state only for rendering.
Domain decisions remain in backend.
```

```python
# apps/api/src/otc_to_book/application/pipeline.py
self.extractor = extractor or DeterministicQuoteExtractor()
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Docs search | `rg -n "provider|Ollama|API key|LLM|control plane|backend-owned|allowlist" docs plans` | shows consistent provider-config terminology |
| Backend tests | `cd apps/api && uv run pytest` | exit 0 |
| Backend lint | `cd apps/api && uv run ruff check .` | exit 0 |
| Backend typecheck | `cd apps/api && uv run python -m compileall src tests` | exit 0 |
| Full version check | `node scripts/check-exact-versions.mjs` | exit 0 |

## Scope

**In scope**:

- `docs/architecture.md`
- `docs/extraction-strategy.md`
- `docs/frontend.md`
- `docs/roadmap.md`
- Optional ADR: `docs/decisions/0006-backend-owned-extraction-provider-config.md`
- `plans/README.md` status

**Out of scope**:

- Implementing provider calls.
- Adding OpenAI, Ollama, Instructor, Pydantic AI, or other dependencies.
- Adding environment variables or secrets.
- Adding UI settings components.
- Persisting provider config.
- Calling arbitrary URLs or external services.

## Git workflow

- Branch: `codex/004-backend-extraction-provider-config`
- Commit message example: `docs: design extraction provider config`
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Document provider ownership

Update `docs/architecture.md` and `docs/extraction-strategy.md` to state:

- The frontend never performs quote extraction.
- The frontend never holds provider API keys.
- The frontend may request extraction mode changes only through backend-owned APIs or WebSocket controls.
- The backend validates and applies extraction configuration.
- Every provider-backed result still returns a `QuoteCandidate` and passes through `QuoteValidator` before book updates.
- Provider-backed results must not bypass deterministic ticker resolution or the session valid ticker pool.

**Verify**: `rg -n "frontend never|backend.*provider|QuoteValidator|API key" docs/architecture.md docs/extraction-strategy.md` -> ownership rules appear.

### Step 2: Define safe provider config shape

Document a future backend config shape without implementing it:

```text
ExtractionProviderConfig
  mode: deterministic | deterministic_fuzzy | deterministic_fuzzy_llm
  llm_provider: disabled | ollama | openai_compatible
  model_name: string
  base_url_ref: configured backend allowlist key, not arbitrary browser URL
  api_key_ref: backend environment/secret reference, never raw key in client payload
  timeout_ms: bounded integer
  confidence_threshold: Decimal-compatible string
  enabled: bool
```

State that browser payloads may select from backend-advertised IDs, but must not
submit raw API keys or arbitrary URLs.

**Verify**: `rg -n "ExtractionProviderConfig|api_key_ref|base_url_ref|allowlist|timeout_ms" docs/extraction-strategy.md docs/architecture.md` -> config shape appears.

### Step 3: Define provider safety gates

Document these gates:

- Provider mode defaults to `deterministic`.
- Ollama/OpenAI-compatible endpoints must be configured server-side or selected from an allowlist.
- Backend must enforce request timeout and max concurrent fallback calls.
- Provider failures degrade to `QuoteRejected` or deterministic-only behavior, never partial book updates.
- Structured output schema is required for LLM providers.
- Provider output must be logged only as metadata; do not log raw API keys or secret-bearing config.

**Verify**: `rg -n "deterministic|allowlist|timeout|concurrent|structured output|secret" docs/extraction-strategy.md docs/architecture.md` -> gates are visible.

### Step 4: Define future dashboard controls without building UI

Update `docs/frontend.md` with a future settings section:

- show current extraction mode;
- select from backend-advertised provider profiles;
- display provider health/latency;
- display extraction method and confidence per parsed event;
- no API key text box in the browser unless a future secure backend secret workflow is explicitly designed.

Do not implement components in this plan.

**Verify**: `rg -n "extraction mode|provider profiles|latency|confidence|API key" docs/frontend.md` -> future UI controls are documented.

### Step 5: Update roadmap ordering

Update `docs/roadmap.md` so provider configuration comes after:

1. deterministic canonicalization;
2. extraction metrics;
3. fallback design.

Make clear that provider config is a design/control-plane step before runtime
LLM extraction.

**Verify**: `rg -n "provider config|control plane|Ollama|OpenAI-compatible|LLM" docs/roadmap.md` -> roadmap ordering appears.

### Step 6: Decide whether to write an ADR

If the architect wants this as a formal decision, create
`docs/decisions/0006-backend-owned-extraction-provider-config.md`:

- Status: Proposed unless explicitly accepted.
- Context: dashboard-configured LLM/Ollama is desired, but frontend-owned secrets and arbitrary URLs are unsafe.
- Decision: backend owns provider config and secrets; frontend is control plane only.
- Consequences: more backend work, safer operations, easier validation and observability.

If no ADR is desired, keep the design in architecture/extraction/frontend/roadmap docs.

**Verify**: `rg -n "backend owns provider config|frontend is control plane|Status" docs/decisions/0006-backend-owned-extraction-provider-config.md` -> only if ADR is created.

## Test plan

This is a design/documentation plan. It should not change runtime behavior.
Verification is documentation consistency plus unchanged backend checks:

- provider ownership documented in architecture and extraction strategy;
- future dashboard controls documented without implementation;
- backend tests still pass;
- no provider SDK, secret, env var, or network call added.

## Done criteria

- [ ] Frontend is documented as control plane only, not extraction runtime.
- [ ] Backend-owned provider config shape is documented.
- [ ] API keys are documented as backend secret references only.
- [ ] Arbitrary browser-submitted provider URLs are explicitly forbidden.
- [ ] Provider fallback still flows through structured output, `QuoteCandidate`, and `QuoteValidator`.
- [ ] Provider fallback still flows through deterministic ticker resolution and the session valid ticker pool.
- [ ] No runtime source code behavior changes.
- [ ] No dependencies, environment variables, secrets, or provider calls added.
- [ ] `cd apps/api && uv run pytest` exits 0.
- [ ] `cd apps/api && uv run ruff check .` exits 0.
- [ ] `cd apps/api && uv run python -m compileall src tests` exits 0.

## STOP conditions

Stop and report if:

- The architect wants browser-owned API keys or direct browser-to-provider extraction.
- The design requires selecting a specific provider SDK or model.
- The design requires network calls, secrets, or environment changes.
- The docs conflict with backend ownership in `docs/architecture.md`.

## Maintenance notes

When this design is eventually implemented, review SSRF risk, secret handling,
timeouts, fallback concurrency, and false-positive extraction behavior before UI
polish. The safest first implementation is disabled-by-default provider profiles
configured server-side, with the dashboard only selecting from known profiles and
displaying diagnostics.
