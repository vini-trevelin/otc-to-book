# Plan 007: Make replay upload update the workstation and honor replay row failures

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a STOP condition occurs, stop and report.
>
> **Drift check (run first)**: `git diff --stat fc9ae05..HEAD -- apps/api/src/otc_to_book/api/main.py apps/api/tests/test_api_ws.py apps/web/app/page.tsx apps/web/tests/e2e/workstation.spec.ts docs/frontend.md`
> If any in-scope file changed, compare the excerpts below with live code before proceeding.

## Status

- **Status**: DONE
- **Priority**: P1
- **Effort**: M
- **Risk**: MED, because this touches API replay semantics and the main workstation flow.
- **Depends on**: none
- **Category**: bug, tests
- **Planned at**: commit `fc9ae05`, 2026-06-23

## Why this matters

`docs/PRODUCT.md` says success means a user can submit or replay broker-style messages, see extraction and validation outcomes, and inspect the resulting book. Replay upload is a first-class deterministic demo path. Today the API returns replay events, but the frontend ignores them and only displays "Replay uploaded". That makes replay look successful without updating chat, parsed events, or the book. The backend also indexes `row["text"]`, so a malformed CSV/JSON row can abort the replay instead of emitting a rejection when possible as required by `docs/architecture.md`.

## Current state

- `apps/api/src/otc_to_book/api/main.py:25-47` handles `POST /samples/replay`, parses rows, loops them, and returns `{"replay_id": replay_id, "events": all_events}`.
- `apps/api/src/otc_to_book/api/main.py:38` uses `text=row["text"]`, which raises when a row lacks `text`.
- `apps/web/app/page.tsx:143-160` uploads the file and, on `response.ok`, only calls `setUploadStatus("Replay uploaded")`.
- `apps/web/tests/e2e/workstation.spec.ts` has no replay upload test. `docs/frontend.md:122` explicitly says replay upload E2E coverage is still needed.
- Existing frontend state updates flow through `dispatch({ type: "server_event", event })`, as seen in `apps/web/app/page.tsx:85-87`.
- Resolved behavior: replay upload clears the current browser workstation state and backend book state through the existing clear path before applying returned replay events. It does not broadcast replay over WebSocket.

Relevant excerpts:

```py
# apps/api/src/otc_to_book/api/main.py:33-47
for index, row in enumerate(rows, start=1):
    raw_message = RawMessage(
        message_id=row.get("message_id") or f"{replay_id}-{index}",
        broker_id=row.get("broker_id") or "USER",
        received_timestamp=row.get("received_timestamp") or utc_now(),
        text=row["text"],
        replay_id=replay_id,
        replay_sequence=index,
    )
    all_events.extend(
        event.model_dump(mode="json")
        for event in pipeline.process_message(raw_message, correlation_id=str(uuid4()))
    )
```

```tsx
// apps/web/app/page.tsx:149-156
const response = await fetch(`${HTTP_URL}/samples/replay`, {
  method: "POST",
  body: formData
});
if (response.ok) {
  setUploadStatus("Replay uploaded");
  return;
}
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `pnpm typecheck` | exit 0 |
| Unit/API tests | `pnpm test` | all tests pass |
| E2E | `pnpm --filter web test:e2e` | all tests pass |
| Extraction metrics | `cd apps/api && uv run python scripts/evaluate_extraction.py` | `exact_row=27/27` and `false_merge=3/3` |

## Scope

**In scope**
- `apps/api/src/otc_to_book/api/main.py`
- `apps/api/tests/test_api_ws.py` or a new API replay test file under `apps/api/tests/`
- `apps/web/app/page.tsx`
- `apps/web/tests/e2e/workstation.spec.ts`
- `docs/frontend.md`

**Out of scope**
- Do not add persistence.
- Do not change extraction templates or fuzzy ticker behavior.
- Do not introduce a generated contract package.
- Do not add a replay-specific `clear_before` endpoint option unless the existing clear path cannot preserve deterministic behavior.

## Git workflow

- Branch: `codex/007-fix-replay-upload-flow`
- Commit message style: `api: fix replay upload flow`
- Do not push unless instructed.

## Steps

### Step 1: Make API replay row handling explicit

In `apps/api/src/otc_to_book/api/main.py`, add a small helper that converts one parsed replay row into either a `RawMessage` or a rejection event path. Keep it minimal. The desired behavior:

- Rows with `text` process normally.
- Rows missing `text` do not abort the replay. Emit a `quote_rejected`-style event when possible by constructing a `RawMessage` with empty text and a stable fallback `message_id`, or use `QuoteValidator.reject_raw_message` through a narrow pipeline helper if needed.
- File-level parse failures, such as invalid JSON, may still return a non-2xx response.

Do not swallow malformed file parse errors silently.

**Verify**: add/adjust API tests, then run `cd apps/api && uv run pytest tests/test_api_ws.py` or the new focused replay test file. Expected: all selected tests pass and a malformed row test proves the replay continues.

### Step 2: Dispatch returned replay events in the frontend

In `apps/web/app/page.tsx`, before posting the replay:

- Stop the simulator first if it is running.
- Use the existing `book_clear` path to clear backend book state.
- Reset local visible workstation state: messages, parsed events, selected/provenance event state, book rows, upload/status context, and any simulator-local running state.

Then, after an OK replay response:

- Parse `await response.json()` as an object containing `events`.
- For each returned event, dispatch it through the same reducer path as WebSocket events: `dispatch({ type: "server_event", event })`.
- Set a status such as `Replay uploaded: N events`.
- If row-level rejections occurred, show one summary warning toast, not one toast per row.
- Preserve the existing error copy for failed HTTP responses and network failures.

Keep domain decisions in the backend. The browser should only render returned server events.

**Verify**: `pnpm --filter web typecheck` exits 0.

### Step 3: Refine the clear-all UI

Add or adjust the Clear all control so it is:

- in the left sidebar footer, under every other sidebar section
- minimal and low-emphasis, using existing shadcn/ui components with the project preset
- labeled `Clear all`
- destructive in behavior but without a confirmation step
- wired to stop the simulator, clear backend book state through `book_clear`, and reset the full visible workstation state

Do not add custom UI primitives for this control.

**Verify**: `pnpm --filter web typecheck` exits 0.

### Step 4: Add E2E coverage for successful replay

In `apps/web/tests/e2e/workstation.spec.ts`, add a test that uploads a small sample fixture and verifies:

- Any previous visible state is cleared before replay results appear.
- Upload status becomes visible.
- At least one raw message from the fixture appears in chat.
- At least one expected book card appears, for example `PETRO27`.
- The parsed event panel can show event provenance after replay.

Use Playwright's file upload support against the existing native file input. Keep the fixture small; use `data/samples/v1_messages.jsonl` if stable enough, or create a temporary fixture inside the test output if Playwright supports it cleanly.

**Verify**: `pnpm --filter web test:e2e` exits 0.

### Step 5: Update docs

Update `docs/frontend.md`:

- Move replay upload E2E coverage out of "still needed" once covered.
- Document that replay upload first clears current workstation state through the existing clear path, then consumes server-returned events and updates chat/book/event state.
- Document that Clear all lives in the left sidebar footer, stops the simulator, and clears full visible state.
- Leave future polish items only for visual affordance/in-progress state if still not implemented.

**Verify**: `rg -n "Replay upload E2E coverage is still needed" docs/frontend.md` returns no matches if E2E coverage has landed.

## Test plan

- API: add a replay test for successful rows and a malformed row that does not abort the whole replay.
- Frontend E2E: upload a fixture and verify chat + book + event provenance update.
- Existing test pattern: model E2E structure after `apps/web/tests/e2e/workstation.spec.ts:9-22`.

## Done criteria

- [ ] Replay upload updates the visible workstation book and chat.
- [ ] Replay upload clears the prior visible workstation state and backend book state before applying replay events.
- [ ] Clear all lives under all other left-sidebar content and clears full state without confirmation.
- [ ] Clear all stops the simulator before clearing state.
- [ ] Malformed replay rows do not abort a full replay when a rejection can be emitted.
- [ ] `pnpm typecheck` exits 0.
- [ ] `pnpm test` exits 0.
- [ ] `pnpm --filter web test:e2e` exits 0 with the new replay test.
- [ ] `cd apps/api && uv run python scripts/evaluate_extraction.py` still reports `exact_row=27/27` and `false_merge=3/3`.

## STOP conditions

- The replay endpoint has been redesigned to broadcast over WebSocket instead of returning events; stop and update this plan.
- Fixing malformed rows requires changing the public event envelope shape.
- The replay fixture data no longer contains any message that should produce a book row.
- Existing `book_clear` cannot clear backend state deterministically before replay without adding new backend behavior.

## Maintenance notes

Reviewers should check that frontend replay handling does not duplicate WebSocket sequence events incorrectly. If replay later becomes a streaming server event, this plan's client-side dispatch path should be revisited.
