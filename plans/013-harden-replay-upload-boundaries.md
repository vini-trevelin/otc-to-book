# Plan 013: Harden replay upload file and parse boundaries

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c1b4958..HEAD -- apps/api/src/otc_to_book/api/main.py apps/api/tests/test_api_ws.py apps/web/lib/use-workstation.ts apps/web/tests/e2e/workstation.spec.ts docs/architecture.md docs/tooling.md`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/012-replay-state-semantics.md`
- **Category**: security, correctness, dx, tests
- **Planned at**: commit `c1b4958`, 2026-06-29

## Why this matters

Replay upload is a public API boundary in the local demo. Current row-level
error handling is good enough for malformed rows, but file-level failures are
still generic: invalid UTF-8, invalid JSON, unsupported extensions, and large
uploads can bubble into non-diagnostic server errors or unbounded memory reads.
For a quant market-data style pipeline, failed ingest should be deterministic,
bounded, and easy to diagnose. This plan hardens file-level replay handling
without changing extraction logic or adding dependencies.

## Current state

Current replay endpoint reads and decodes the whole file directly:

```python
# apps/api/src/otc_to_book/api/main.py:55-60
@app.post("/samples/replay")
async def replay_samples(file: UploadFile = SAMPLE_FILE) -> dict[str, Any]:
    pipeline = _pipeline()
    replay_id = str(uuid4())
    content = (await file.read()).decode("utf-8")
    rows = _parse_sample_rows(file.filename or "", content)
```

The parser infers format by filename and lets JSON errors escape:

```python
# apps/api/src/otc_to_book/api/main.py:193-209
def _parse_sample_rows(filename: str, content: str) -> list[Any]:
    if filename.endswith(".csv"):
        return list(csv.DictReader(StringIO(content)))

    rows = []
    stripped = content.strip()
    if not stripped:
        return rows
    if filename.endswith(".jsonl"):
        for line in stripped.splitlines():
            rows.append(json.loads(line))
        return rows

    parsed = json.loads(stripped)
    if isinstance(parsed, list):
        return parsed
    return [parsed]
```

Existing file-level test coverage only covers a row missing `text`, not invalid
file input:

```python
# apps/api/tests/test_api_ws.py:93-118
def test_replay_continues_after_row_missing_text() -> None:
    ...
    assert body["rejected_rows"] == 1
    assert [event["event_type"] for event in body["events"]].count("quote_rejected") >= 1
```

Current frontend surfaces non-OK replay responses with a generic message:

```ts
// apps/web/lib/use-workstation.ts:213-219
const response = await fetch(`${HTTP_URL}/samples/replay`, {
  method: "POST",
  body: formData
});
if (!response.ok) {
  setUploadError("Replay failed. Check file type/schema, then retry.");
  return;
}
```

Repo constraints:

- Do not add unpinned dependencies.
- Keep replay row-level failures best-effort, but file-level parse failures may
  return non-2xx responses.
- Keep business logic in backend/domain/application layers; replay file parsing
  can stay in the API boundary for V1.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| API replay tests | `cd apps/api && uv run pytest tests/test_api_ws.py -k replay` | exit 0; replay tests pass |
| API full tests | `cd apps/api && uv run pytest` | exit 0; all API tests pass |
| API lint | `cd apps/api && uv run ruff check .` | exit 0; `All checks passed!` |
| API typecheck | `cd apps/api && uv run python -m compileall src tests` | exit 0 |
| Web unit tests | `pnpm --filter web test` | exit 0 |
| E2E replay flow | `pnpm --filter web test:e2e -- tests/e2e/workstation.spec.ts` | exit 0 |
| Full local gate | `pnpm verify` | exit 0 |

## Scope

**In scope**:

- `apps/api/src/otc_to_book/api/main.py`
- `apps/api/tests/test_api_ws.py`
- `apps/web/lib/use-workstation.ts` only for displaying backend replay error detail from a safe `detail` field
- `apps/web/tests/e2e/workstation.spec.ts` only if an E2E failure-state test is added
- `docs/architecture.md` only for concise replay file-boundary rules
- `plans/README.md` status row

**Out of scope**:

- New dependencies.
- Virus scanning, object storage, authentication, or production upload service design.
- Changing row-level extraction or validation behavior.
- Changing replay state semantics from Plan 012.
- Reworking the replay upload UI; that belongs to `plans/014-polish-replay-upload-ux.md`.
- Adding persistence or streaming replay.

## Git workflow

- Branch: `replay-hardening`
- Commit message example: `api: harden replay upload boundaries`
- Land this after `plans/012-replay-state-semantics.md` on the same branch.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Define explicit replay upload limits and error shape

In `apps/api/src/otc_to_book/api/main.py`, add small constants near
`SAMPLE_FILE`:

```python
MAX_REPLAY_UPLOAD_BYTES = 20_000_000
SUPPORTED_REPLAY_SUFFIXES = {".csv", ".json", ".jsonl"}
```

Use only standard library imports. If you need suffix handling, use
`pathlib.PurePath` or a small helper; do not add dependencies.
Treat "CSV + JSON" support as `.csv`, `.json`, and existing JSON Lines
`.jsonl` support, because the current replay fixture path uses `.jsonl`.

Define replay file-level errors as FastAPI `HTTPException` responses with a
plain, safe `detail` string. Use deterministic messages such as:

- `unsupported replay file type`
- `replay file is too large`
- `replay file must be utf-8`
- `replay file is empty`
- `replay file could not be parsed`

Do not include raw file contents or exception traces in responses.

**Verify**: `cd apps/api && uv run ruff check .` -> exits 0 after imports/constants are added.

### Step 2: Bound file reads and UTF-8 decoding

Change `replay_samples()` so it reads at most `MAX_REPLAY_UPLOAD_BYTES + 1`
bytes. If the read exceeds the limit, return `413` with
`detail="replay file is too large"`.

Decode bytes as UTF-8 inside a narrow `try`/`except UnicodeDecodeError`; return
`400` with `detail="replay file must be utf-8"` on failure.

Keep the successful response shape unchanged:

```json
{"replay_id": "...", "events": [...], "rejected_rows": 0}
```

**Verify**: add focused tests in Step 4, then run `cd apps/api && uv run pytest tests/test_api_ws.py -k replay`.

### Step 3: Validate file type and parse errors

Refactor `_parse_sample_rows(filename, content)` so file-level validation is
explicit:

- reject unsupported suffixes before parsing;
- return `400` for empty files;
- parse `.csv` with `csv.DictReader`;
- parse `.jsonl` line by line and fail the whole file on invalid JSON syntax;
- parse `.json` as either one object or a list of objects;
- keep row-level shape validation in `_raw_message_from_replay_row()`.

Implementation note: `_parse_sample_rows()` can raise `HTTPException` directly
because it is an API-boundary helper. Keep row-level `UNSUPPORTED_TEMPLATE`
behavior separate.

Do not treat a row missing `text` as a file-level parse failure. That behavior
is already covered and must remain row-level.

**Verify**: `cd apps/api && uv run pytest tests/test_api_ws.py -k replay` -> all replay tests pass after Step 4.

### Step 4: Add file-level replay tests

In `apps/api/tests/test_api_ws.py`, add tests for these cases:

- unsupported extension, e.g. `sample.txt` -> `400`, detail mentions unsupported type;
- invalid JSON file -> `400`, detail mentions parse;
- invalid JSONL line -> `400`, detail mentions parse;
- invalid UTF-8 bytes -> `400`, detail mentions UTF-8;
- empty file -> `400`, detail mentions empty;
- oversized file -> `413`, detail mentions too large;
- valid `.json` object still replays successfully;
- valid `.json` array still replays successfully;
- existing row-missing-text test remains `200` with row-level rejection.

Use `TestClient(app)` and existing file upload style:

```python
response = client.post(
    "/samples/replay",
    files={"file": ("sample.jsonl", payload, "application/jsonl")},
)
```

If a direct oversized test would be too noisy, generate `b"x" * (MAX_REPLAY_UPLOAD_BYTES + 1)` by importing the constant from `otc_to_book.api.main`.

**Verify**: `cd apps/api && uv run pytest tests/test_api_ws.py -k replay` -> all replay tests pass.

### Step 5: Surface safe backend error details in the frontend

In `apps/web/lib/use-workstation.ts`, when `response.ok` is false, try to parse
the response as JSON and read a string `detail` field. If present, show:

```text
Replay failed: <detail>
```

If no safe detail is available, keep the existing generic message. Do not show
stack traces or raw response bodies.

This is a minimal DX improvement, not the replay UI polish plan. Do not add
uploading state or redesign the file input here.

**Verify**: `pnpm --filter web test` -> exits 0.

### Step 6: Update docs narrowly

Update `docs/architecture.md` replay rules to include file-level boundary
behavior:

- unsupported file types fail before row processing;
- invalid JSON/CSV file parsing fails the upload;
- malformed rows still emit row-level rejection events when possible;
- upload size is bounded at 20MB.

Keep the wording concise. Do not turn this into production upload architecture.

**Verify**: `rg -n "unsupported file|too large|malformed rows|row-level|replay" docs/architecture.md` -> replay file-boundary rules are visible.

## Test plan

- API tests in `apps/api/tests/test_api_ws.py` for file-level failures and
  valid `.json` / `.jsonl` / `.csv` paths.
- Existing replay row-level rejection test remains passing.
- Frontend unit tests remain passing after safe error detail parsing.
- Existing replay E2E remains passing.

## Done criteria

ALL must hold:

- [ ] Replay upload reads are byte-bounded.
- [ ] Unsupported file suffixes return deterministic 400 responses.
- [ ] Invalid UTF-8 returns deterministic 400.
- [ ] Invalid JSON/JSONL returns deterministic 400.
- [ ] Empty replay files return deterministic 400.
- [ ] Oversized replay files return deterministic 413.
- [ ] Existing row-level malformed row behavior still returns 200 and `quote_rejected` events.
- [ ] Valid `.csv`, `.json`, and `.jsonl` replay inputs still work.
- [ ] Frontend shows safe backend replay error detail when available.
- [ ] `cd apps/api && uv run pytest tests/test_api_ws.py -k replay` exits 0.
- [ ] `cd apps/api && uv run pytest` exits 0.
- [ ] `cd apps/api && uv run ruff check .` exits 0.
- [ ] `cd apps/api && uv run python -m compileall src tests` exits 0.
- [ ] `pnpm --filter web test` exits 0.
- [ ] `pnpm --filter web test:e2e -- tests/e2e/workstation.spec.ts` exits 0.
- [ ] No files outside the in-scope list are modified except `plans/README.md` status.

## STOP conditions

Stop and report if:

- FastAPI/Starlette upload handling makes byte-bounded reads impossible without
  introducing dependencies or middleware outside this plan.
- The desired error behavior conflicts with existing product expectations for
  row-level replay errors.
- Tests require changing global app state in a way that affects unrelated
  WebSocket or pipeline tests.
- The frontend change grows into a UI redesign. Defer that to Plan 014.

## Maintenance notes

This plan is defensive local-demo hardening, not production file-ingest
infrastructure. The architect-selected replay upload cap is 20MB for V1. If
replay files become larger benchmark datasets later, revisit the
`MAX_REPLAY_UPLOAD_BYTES` value and consider streaming parse logic. Reviewers
should ensure file-level errors never include raw uploaded content and row-level
malformed input remains diagnosable through `quote_rejected` events.
