# Plan 009: Add runtime validation at WebSocket and frontend event boundaries

> **Executor instructions**: Follow this plan step by step. Run every verification command. If a STOP condition occurs, stop and report.
>
> **Drift check (run first)**: `git diff --stat fc9ae05..HEAD -- apps/api/src/otc_to_book/api/main.py apps/api/src/otc_to_book/domain/models.py apps/api/src/otc_to_book/domain/validation.py apps/web/lib/events.ts apps/web/lib/state.ts apps/web/app/page.tsx`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED, because it changes request/event boundary behavior.
- **Depends on**: 007 is recommended first because replay event dispatch will create another event ingestion path.
- **Category**: correctness, security, architecture
- **Planned at**: commit `fc9ae05`, 2026-06-23

## Why this matters

The architecture document defines a stable event envelope, but runtime code still uses loose strings and unchecked payloads. The API manually reads WebSocket dictionaries and can raise on malformed payloads. The frontend parses WebSocket JSON and then casts payloads by event type. For a quant market-data style pipeline, diagnosable boundary failures are more valuable than silent no-ops or generic crashes.

## Current state

- `EventEnvelope.event_type` is `str` in `apps/api/src/otc_to_book/domain/models.py:178-186`.
- `apps/api/src/otc_to_book/api/main.py:69-103` reads `event_type` and `payload` from raw dictionaries and indexes `payload["text"]`.
- `QuoteValidator.validate()` suppresses type narrowing with `# type: ignore[arg-type]` at `apps/api/src/otc_to_book/domain/validation.py:35-39`.
- Frontend `EventEnvelope<TPayload = unknown>` has typed event names, but `apps/web/lib/state.ts:77,84,91,98` casts `event.payload` without runtime validation.
- `apps/web/app/page.tsx:85-87` dispatches `JSON.parse(event.data)` directly.

Relevant excerpts:

```py
# apps/api/src/otc_to_book/domain/models.py:178-186
class EventEnvelope(DomainModel):
    event_id: str
    event_type: str
    schema_version: int = 1
    sequence: int = Field(ge=1)
    session_id: str
    correlation_id: str
    occurred_at: datetime
    payload: dict[str, Any]
```

```tsx
// apps/web/lib/state.ts:74-99
if (event.event_type === "message_received") {
  return {
    ...next,
    messages: [event.payload as RawMessagePayload, ...state.messages].slice(0, 80)
  };
}
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| API focused tests | `cd apps/api && uv run pytest tests/test_api_ws.py tests/test_event_contracts.py tests/test_validation.py` | all pass |
| Web tests | `pnpm --filter web test` | all pass |
| Typecheck | `pnpm typecheck` | exit 0 |
| E2E | `pnpm --filter web test:e2e` | all pass |

## Scope

**In scope**
- `apps/api/src/otc_to_book/domain/models.py`
- `apps/api/src/otc_to_book/api/main.py`
- `apps/api/src/otc_to_book/domain/validation.py`
- `apps/api/tests/test_api_ws.py`
- `apps/api/tests/test_event_contracts.py`
- `apps/web/lib/events.ts`
- `apps/web/lib/state.ts`
- `apps/web/app/page.tsx`
- `apps/web/tests/state.test.ts`

**Out of scope**
- Do not generate a shared contract package.
- Do not add Zod or new runtime validation libraries unless explicitly approved; prefer small local type guards for this repo size.
- Do not change the public event envelope shape unless tests and docs are updated.

## Git workflow

- Branch: `codex/009-add-runtime-event-contract-validation`
- Commit message style: `api: validate event contracts`

## Steps

### Step 1: Tighten backend event names

Add a `StrEnum` for server event types and, if helpful, client event types in `apps/api/src/otc_to_book/domain/models.py`. Update `EventEnvelope.event_type` to that enum or a literal-compatible enum type. Update `QuotePipeline._envelope()` to accept the enum or validate strings centrally.

**Verify**: `cd apps/api && uv run pytest tests/test_event_contracts.py` passes.

### Step 2: Validate WebSocket client messages

Add small Pydantic request models for:

- `user_message`
- `simulator_start`
- `simulator_stop`
- `book_clear`

Parse `await websocket.receive_json()` into a discriminated structure or a simple envelope model plus event-specific payload models. On malformed input, send a rejection/error event or close with a clear code. Keep behavior deterministic and diagnosable.

**Verify**: add tests in `tests/test_api_ws.py` for missing user message text and invalid simulator rates. Expected: no unhandled exception and a deterministic failure response/close behavior.

### Step 3: Remove validator type ignores by narrowing

In `QuoteValidator.validate()`, after rejection reasons are empty, assign non-optional fields to local variables and assert/narrow them without `# type: ignore`. The validation method already proves they are present; make that proof visible to the type checker.

**Verify**: `cd apps/api && uv run ruff check . && cd apps/api && uv run python -m compileall src tests` passes.

### Step 4: Add frontend event guards

In `apps/web/lib/events.ts`, add narrow runtime guards such as `isEventEnvelope`, `isRawMessagePayload`, `isBookStatePayload`. Keep them local and explicit. In `page.tsx`, guard parsed WebSocket messages before dispatch. In `state.ts`, avoid naked payload casts where possible by using the guards per event type.

Invalid events should be ignored or surfaced as a small UI error state. Do not crash the workstation.

**Verify**: add reducer tests for invalid payloads and run `pnpm --filter web test`.

## Test plan

- API tests for valid user message, invalid user message, invalid simulator config, unknown event type.
- Frontend tests for valid server events and malformed payloads.
- E2E smoke remains unchanged and must pass.

## Done criteria

- [ ] Backend event names are constrained by code, not only docs.
- [ ] Malformed WebSocket client messages fail deterministically.
- [ ] `# type: ignore[arg-type]` is removed from `QuoteValidator.validate()`.
- [ ] Frontend WebSocket messages are runtime-guarded before reducer mutation.
- [ ] `pnpm typecheck`, `pnpm --filter web test`, focused API tests, and E2E all pass.

## STOP conditions

- A generated shared contract package becomes necessary to avoid duplicating large schemas.
- FastAPI/WebSocket test support cannot observe the intended error response.
- The public event envelope shape must change.

## Maintenance notes

This is a bridge until a generated contract package exists. Keep guards explicit and small; do not build a generic validation framework.
