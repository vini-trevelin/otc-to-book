# Plan 012: Make replay state semantics explicit and consistent

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c1b4958..HEAD -- apps/api/src/otc_to_book/api/main.py apps/api/src/otc_to_book/application/pipeline.py apps/api/tests/test_api_ws.py apps/web/lib/use-workstation.ts apps/web/tests/e2e/workstation.spec.ts docs/architecture.md docs/frontend.md`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: correctness, architecture, tests
- **Planned at**: commit `c1b4958`, 2026-06-29

## Why this matters

Replay upload is now a first-class demo path, but its state semantics are only
partially explicit. The API uses one shared backend `QuotePipeline`, so
`POST /samples/replay` mutates shared backend book state. The response events
are then applied only by the uploading browser. That is internally consistent
for a one-browser demo, but it becomes misleading as soon as two browser
workstations are connected: one browser can upload a replay that changes the
backend book while the other browser never sees those replay events. This plan
chooses and implements one clear model: replay remains a single-workstation
HTTP demo path and must not mutate the shared WebSocket pipeline state. That
requires both an isolated HTTP replay pipeline and a frontend replay pre-clear
that resets only the uploading browser's visible state.

## Current state

Relevant repo decisions:

- `docs/architecture.md:46-48` says V1 should be WebSocket-first.
- `docs/architecture.md:101-108` defines replay rules and currently says replay
  applies returned events only in the uploading browser.
- `docs/architecture.md:146-156` says future multi-broker and broader lifecycle
  phases are out of V1 scope.

Current API replay code mutates the shared app pipeline:

```python
# apps/api/src/otc_to_book/api/main.py:55-77
@app.post("/samples/replay")
async def replay_samples(file: UploadFile = SAMPLE_FILE) -> dict[str, Any]:
    pipeline = _pipeline()
    replay_id = str(uuid4())
    content = (await file.read()).decode("utf-8")
    rows = _parse_sample_rows(file.filename or "", content)
    all_events = []
    rejected_rows = 0

    for index, row in enumerate(rows, start=1):
        raw_message, row_reasons = _raw_message_from_replay_row(row, replay_id, index)
        if row_reasons:
            rejected_rows += 1
            events = pipeline.reject_message(
                raw_message,
                row_reasons,
                correlation_id=str(uuid4()),
            )
        else:
            events = pipeline.process_message(raw_message, correlation_id=str(uuid4()))
        all_events.extend(event.model_dump(mode="json") for event in events)

    return {"replay_id": replay_id, "events": all_events, "rejected_rows": rejected_rows}
```

The shared pipeline is process-global:

```python
# apps/api/src/otc_to_book/api/main.py:187-190
def _pipeline() -> QuotePipeline:
    if not hasattr(app.state, "pipeline"):
        app.state.pipeline = QuotePipeline()
    return app.state.pipeline
```

WebSocket clients also use this same shared pipeline:

```python
# apps/api/src/otc_to_book/api/main.py:80-84
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    pipeline = _pipeline()
    simulator_task: asyncio.Task[None] | None = None
```

The current frontend intentionally applies replay response events locally, but
it also calls `clearAll()` first:

```ts
// apps/web/lib/use-workstation.ts:203-231
const uploadReplay = useCallback(
  async (file: File | null) => {
    if (!file) return;
    setUploadStatus("");
    setUploadError("");
    await clearAll();
    ...
const body = (await response.json()) as ReplayResponse;
let acceptedEvents = 0;
for (const event of body.events) {
  if (isEventEnvelope(event) && isValidServerEventPayload(event)) {
    handleServerEvent(event);
    acceptedEvents += 1;
  } else {
    handleUnknownServerEvent("Ignored malformed replay event");
  }
}
setUploadStatus(`Replay uploaded: ${acceptedEvents} events`);
```

That `clearAll()` helper sends `book_clear` to the shared backend pipeline:

```ts
// apps/web/lib/use-workstation.ts:138-156
const clearAll = useCallback(async () => {
  ...
  dispatch({ type: "clear_all" });
  ...
  const clearAck = waitForClear();
  sendClientEvent({ event_type: "book_clear", payload: {} });
  await clearAck;
}, [sendClientEvent, state.simulatorRunning, stopSimulator, waitForClear]);
```

Existing API test coverage proves replay continues after a bad row, but does
not test replay isolation from WebSocket state:

```python
# apps/api/tests/test_api_ws.py:93-118
def test_replay_continues_after_row_missing_text() -> None:
    ...
    assert body["events"][-1]["event_type"] == "book_updated"
    assert body["events"][-1]["payload"]["books"]["PETRO27"]["best_ask"] is not None
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| API targeted tests | `cd apps/api && uv run pytest tests/test_api_ws.py tests/test_pipeline.py tests/test_event_contracts.py` | exit 0; all selected tests pass |
| API full tests | `cd apps/api && uv run pytest` | exit 0; all API tests pass |
| API lint | `cd apps/api && uv run ruff check .` | exit 0; `All checks passed!` |
| API typecheck | `cd apps/api && uv run python -m compileall src tests` | exit 0 |
| Web unit tests | `pnpm --filter web test` | exit 0; all Vitest tests pass |
| E2E replay flow | `pnpm --filter web test:e2e -- tests/e2e/workstation.spec.ts` | exit 0; workstation E2E passes |
| Full local gate | `pnpm verify` | exit 0 |

## Scope

**In scope**:

- `apps/api/src/otc_to_book/api/main.py`
- `apps/api/tests/test_api_ws.py`
- `apps/web/lib/use-workstation.ts`
- `apps/web/tests/e2e/workstation.spec.ts`
- `docs/architecture.md`
- `docs/frontend.md` only if wording needs to stay aligned with the selected replay model
- `tasks/todo.md` only to record the result after implementation
- `plans/README.md` status row

**Out of scope**:

- Broadcasting replay events to all WebSocket clients.
- Adding a WebSocket replay command.
- Adding persistence, per-user authentication, browser sessions, or database-backed books.
- Changing extraction, validation, ticker resolution, or book sorting semantics.
- Changing frontend upload UI; that belongs to `plans/014-polish-replay-upload-ux.md`.
- Hardening file size/type/parse errors; that belongs to `plans/013-harden-replay-upload-boundaries.md`.

## Git workflow

- Branch: `replay-hardening`
- Commit message example: `api: isolate replay pipeline state`
- Keep this plan as the first commit on the branch if executing sequentially.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add a failing API regression test for HTTP replay isolation

In `apps/api/tests/test_api_ws.py`, add a test that proves HTTP replay does not
change the shared WebSocket pipeline book. Model the current test style, using
`TestClient(app)`.

Target behavior:

1. Open a WebSocket.
2. Send a `user_message` such as `vendo vale29 7.40 3mm` and consume the four
   normal events.
3. POST a replay file over HTTP containing `vendo petro27 7.30 5mm`.
4. Send another WebSocket `user_message`, for example `bid vale29 7.35`.
5. Consume the resulting `book_updated` event from the WebSocket.
6. Assert that the WebSocket book contains `VALE29` and does not contain
   `PETRO27`.
7. Also assert that the HTTP replay response itself contains `PETRO27`, proving
   replay still works for the uploading/browser-local response.

Name the test something explicit, for example:

```python
def test_replay_uses_isolated_pipeline_state_without_mutating_websocket_book() -> None:
    ...
```

This API test should fail before Step 2 because `replay_samples()` currently uses
the shared `_pipeline()`.

**Verify**: `cd apps/api && uv run pytest tests/test_api_ws.py -k replay_uses_isolated_pipeline_state` -> fails before Step 2 for the expected reason.

### Step 2: Use an isolated `QuotePipeline` for HTTP replay

In `apps/api/src/otc_to_book/api/main.py`, change `replay_samples()` so it does
not call `_pipeline()`. Create a fresh `QuotePipeline()` for each replay request:

```python
pipeline = QuotePipeline()
```

Keep the rest of the replay loop behavior unchanged:

- one `replay_id` per upload;
- rows processed in file order;
- row-level malformed rows emit `quote_rejected` events when possible;
- the response still returns `{"replay_id": ..., "events": ..., "rejected_rows": ...}`;
- the frontend can still apply returned events locally.

Do not change the replay response contract in this plan. If implementation
reveals a genuine response-shape gap, stop and ask the architect before adding
fields or changing semantics.

Do not reset the shared WebSocket pipeline here. Step 3 removes the frontend
`book_clear` call from the replay upload path, so this step separates backend
shared book state from HTTP replay response state.

**Verify**: `cd apps/api && uv run pytest tests/test_api_ws.py -k replay_uses_isolated_pipeline_state` -> the new test passes.

### Step 3: Make replay pre-clear local-only in the frontend

In `apps/web/lib/use-workstation.ts`, keep the visible replay behavior: old
chat, parsed events, upload status, and book rows disappear before replay events
are applied. But do not call `clearAll()` from `uploadReplay()`, because
`clearAll()` sends `book_clear` to the shared WebSocket pipeline.

Create a small local helper inside the hook, for example:

```ts
const resetVisibleWorkstationState = useCallback(() => {
  dispatch({ type: "clear_all" });
  setMessage(DEFAULT_MESSAGE);
  setBrokerId(DEFAULT_BROKER_ID);
  setRandomness(DEFAULT_RANDOMNESS);
  setNoiseRate(DEFAULT_NOISE_RATE);
  setChaosRate(DEFAULT_CHAOS_RATE);
  setTickerTypoRate(DEFAULT_TICKER_TYPO_RATE);
  setTemplateNoiseRate(DEFAULT_TEMPLATE_NOISE_RATE);
  setIntervalMs(DEFAULT_INTERVAL_MS);
  setUploadStatus("");
  setUploadError("");
}, []);
```

Then:

- keep `clearAll()` as the explicit Clear all command that sends `book_clear`;
- in `uploadReplay()`, stop the simulator if needed, then call the local reset
  helper instead of `await clearAll()`;
- do not wait for a backend clear ack before HTTP replay upload;
- keep replay response event dispatch unchanged.

If sharing code between `clearAll()` and replay reset is cleaner, do so, but the
distinction must remain explicit: Clear all mutates backend book state, replay
pre-clear does not.

**Verify**: `pnpm --filter web test` -> exits 0.

### Step 4: Add an E2E regression for replay not clearing another workstation

In `apps/web/tests/e2e/workstation.spec.ts`, add a two-page test that proves
the replay upload path does not mutate the shared WebSocket pipeline via
`book_clear`.

Suggested flow:

1. Create two pages in the same Playwright test.
2. Open `/` in both and wait for `connected`.
3. On page B, send `vendo bova26 7.40 3mm` and wait for `book-card-BOVA26`.
4. On page A, upload `../../data/samples/v1_messages.jsonl` via Replay fixture.
5. On page B, send `bid vale29 7.35`.
6. Assert page B's resulting visible book still includes `book-card-BOVA26` and
   now includes `book-card-VALE29`.

This detects accidental backend clear mutation from page A's replay flow: if
page A still sends `book_clear`, page B's next `book_updated` event will be
derived from a cleared backend book and `BOVA26` will disappear.

Keep this test focused. Do not assert every replay row or parsed event detail.

**Verify**: `pnpm --filter web test:e2e -- tests/e2e/workstation.spec.ts` -> exits 0.

### Step 5: Preserve existing replay and WebSocket tests

Run the full API boundary test set to make sure this change did not alter
existing accepted behavior:

```bash
cd apps/api && uv run pytest tests/test_api_ws.py tests/test_pipeline.py tests/test_event_contracts.py
```

Expected result:

- `test_replay_continues_after_row_missing_text` still passes.
- WebSocket user message, simulator, clear, and invalid command tests still pass.
- Event envelope contract tests still pass.

**Verify**: command above exits 0.

### Step 6: Update architecture wording

Update `docs/architecture.md` replay wording narrowly. Replace or adjust the
current line at `docs/architecture.md:108` so it says:

- the current workstation replay flow clears only the uploading browser's
  visible state before applying returned replay events;
- the HTTP replay itself is processed through an isolated replay pipeline;
- returned replay events apply only in the uploading browser;
- replay does not broadcast over WebSocket and does not mutate the shared
  WebSocket pipeline state.

Keep the language concise. Do not introduce multi-user, persistence, or auth
architecture here.

**Verify**: `rg -n "isolated replay pipeline|does not mutate|uploading browser|WebSocket" docs/architecture.md` -> the selected replay semantics are documented.

### Step 7: Run UI regression coverage

The existing frontend replay path should keep passing because it consumes the
HTTP replay response events locally. Run:

```bash
pnpm --filter web test
pnpm --filter web test:e2e -- tests/e2e/workstation.spec.ts
```

Expected result:

- Vitest exits 0.
- Playwright workstation spec exits 0.
- The existing E2E `replay upload clears old state and populates chat, events, and book` remains green.

**Verify**: commands above exit 0.

## Test plan

- Add one API regression test in `apps/api/tests/test_api_ws.py` for isolated
  replay pipeline state.
- Add one two-page Playwright regression proving replay upload does not clear
  another workstation's next backend-derived book update.
- Preserve existing replay malformed-row test.
- Preserve existing WebSocket event contract tests.
- Preserve existing frontend replay E2E behavior.

## Done criteria

ALL must hold:

- [ ] `replay_samples()` uses a fresh `QuotePipeline()` and no longer mutates the shared `_pipeline()`.
- [ ] Frontend replay upload no longer calls `clearAll()` or sends `book_clear` before HTTP replay.
- [ ] HTTP replay response events still contain accepted quote/book events for the uploaded fixture.
- [ ] WebSocket book state does not gain HTTP replay rows unless a WebSocket command created them.
- [ ] Another open workstation is not cleared by one browser's replay upload.
- [ ] `cd apps/api && uv run pytest tests/test_api_ws.py tests/test_pipeline.py tests/test_event_contracts.py` exits 0.
- [ ] `cd apps/api && uv run pytest` exits 0.
- [ ] `cd apps/api && uv run ruff check .` exits 0.
- [ ] `cd apps/api && uv run python -m compileall src tests` exits 0.
- [ ] `pnpm --filter web test` exits 0.
- [ ] `pnpm --filter web test:e2e -- tests/e2e/workstation.spec.ts` exits 0.
- [ ] `docs/architecture.md` documents the isolated replay pipeline semantics.
- [ ] No files outside the in-scope list are modified except `plans/README.md` status.

## STOP conditions

Stop and report if:

- The architect decides replay should broadcast to all connected WebSocket clients instead of staying browser-local. That is a different architecture with connection management and broadcast tests.
- The fix appears to require auth/session identity, persistence, a database, or a multi-client connection registry.
- The existing replay response contract appears insufficient and would need new
  fields or changed semantics.
- Existing E2E replay behavior cannot be preserved after the isolated pipeline change.
- The two-page E2E test proves broader shared-state semantics are already inconsistent outside replay, requiring a separate workstation-session architecture decision.
- The new regression test cannot be written without relying on sleeps or timing races.

## Maintenance notes

This plan intentionally keeps replay as an HTTP, browser-local demo path. If the
project later supports multi-user workstations or production broker streams,
replay should probably become an explicit WebSocket command or a backend
broadcast event stream with per-client subscription semantics. Reviewers should
scrutinize that no future replay changes silently mutate shared book state
without either broadcasting the corresponding events or documenting the session
boundary.
