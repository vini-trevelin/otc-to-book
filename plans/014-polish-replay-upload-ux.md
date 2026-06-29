# Plan 014: Polish replay upload UX and in-progress state

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat c1b4958..HEAD -- apps/web/lib/use-workstation.ts apps/web/components/workstation/left-sidebar.tsx apps/web/tests/e2e/workstation.spec.ts apps/web/tests/state.test.ts docs/frontend.md`
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `plans/013-harden-replay-upload-boundaries.md`
- **Category**: frontend, tests
- **Planned at**: commit `c1b4958`, 2026-06-29

## Why this matters

Replay is a first-class deterministic demo path, but its upload interaction
still looks and behaves like a raw native file input. The frontend docs already
call out two specific gaps: polish the replay upload affordance and add
in-progress state. This plan improves the workstation feel while keeping the
backend as the owner of replay parsing and extraction. It should not change
domain semantics, event envelopes, or replay processing.

## Current state

Frontend docs explicitly list this as backlog:

```text
# docs/frontend.md:142-159
Items to revisit when polishing:

- Replay upload still presents as a native file input; it should become a quieter button/label control while preserving native behavior.
...
3. Polish replay upload into a quieter button/label control while preserving native file behavior.
   Acceptance: upload affordance aligns with compact controls and keeps visible success/failure feedback.
4. Add replay upload in-progress state.
   Acceptance: uploading cannot appear idle while processing.
```

Current hook state has status/error strings but no uploading flag:

```ts
// apps/web/lib/use-workstation.ts:46-47
const [uploadStatus, setUploadStatus] = useState("");
const [uploadError, setUploadError] = useState("");
```

Current upload handler clears state, posts the file, and then sets status:

```ts
// apps/web/lib/use-workstation.ts:203-237
const uploadReplay = useCallback(
  async (file: File | null) => {
    if (!file) return;
    setUploadStatus("");
    setUploadError("");
    await clearAll();

    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch(`${HTTP_URL}/samples/replay`, {
        method: "POST",
        body: formData
      });
      if (!response.ok) {
        setUploadError("Replay failed. Check file type/schema, then retry.");
        return;
      }
      ...
      setUploadStatus(`Replay uploaded: ${acceptedEvents} events`);
    } catch {
      setUploadError("Replay failed. API unavailable; verify backend on port 8000.");
    }
  },
  [clearAll, handleServerEvent, handleUnknownServerEvent]
);
```

Current component renders a visible native file input:

```tsx
// apps/web/components/workstation/left-sidebar.tsx:254-262
<Label className="block text-[11px] text-[var(--muted-foreground)]">
  Replay fixture
  <Input
    className="mt-1.5 block h-7 w-full text-[11px]"
    type="file"
    accept=".csv,.json,.jsonl"
    onChange={(event) => void controller.uploadReplay(event.target.files?.[0] ?? null)}
  />
</Label>
```

Existing E2E validates successful replay by using the label:

```ts
// apps/web/tests/e2e/workstation.spec.ts:65-83
test("replay upload clears old state and populates chat, events, and book", async ({ page }) => {
  ...
  await page.getByLabel("Replay fixture").setInputFiles("../../data/samples/v1_messages.jsonl");
  await expect(page.getByText(/Replay uploaded: \d+ events/)).toBeVisible();
  ...
});
```

Design constraints to preserve:

- Workstation, not marketing page.
- Compact controls.
- Use icons in buttons when possible.
- Do not add success toasts for replay; text status is enough.
- Toast warnings remain for replay row rejections or malformed returned events.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Web unit tests | `pnpm --filter web test` | exit 0; all Vitest tests pass |
| Web typecheck | `pnpm --filter web typecheck` | exit 0 |
| Web lint | `pnpm --filter web lint` | exit 0 |
| E2E targeted | `pnpm --filter web test:e2e -- tests/e2e/workstation.spec.ts` | exit 0; workstation spec passes |
| Full local gate | `pnpm verify` | exit 0 |

## Scope

**In scope**:

- `apps/web/lib/use-workstation.ts`
- `apps/web/components/workstation/left-sidebar.tsx`
- `apps/web/tests/e2e/workstation.spec.ts`
- `docs/frontend.md`
- `plans/README.md` status row

**Out of scope**:

- API replay parsing or backend semantics.
- Event envelope changes.
- Adding new UI primitive libraries.
- Adding success toasts.
- Reworking simulator controls, book rows, sidebars, or event panel behavior.
- Keyboard accelerators beyond replay upload accessibility.

## Git workflow

- Branch: `replay-hardening`
- Commit message example: `web: polish replay upload state`
- Land this after Plans 012 and 013 on the same branch.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Add explicit upload state to the workstation hook

In `apps/web/lib/use-workstation.ts`, add:

```ts
const [uploadingReplay, setUploadingReplay] = useState(false);
```

Return it from `useWorkstation()`.

Update `uploadReplay()`:

- if no file, return as today;
- if already uploading, ignore the second request;
- set `uploadingReplay` to `true` before the local replay reset and upload POST;
- set it back to `false` in a `finally` block;
- keep existing `uploadStatus` and `uploadError` behavior;
- do not show a success toast.

Make sure the `finally` path runs for non-OK responses and network failures.

**Verify**: `pnpm --filter web typecheck` -> exits 0.

### Step 2: Replace visible native file input with a compact button/label

In `apps/web/components/workstation/left-sidebar.tsx`, preserve the native
`input type="file"` for browser behavior, but visually hide it and trigger it
through a compact button-like label.

Suggested shape:

- Use a `Label` or `Button`-styled `label` with an upload-style icon from
  `lucide-react`, such as `Upload`.
- Keep accessible text `Replay fixture`.
- Keep the input associated with the label by `id`.
- Apply `sr-only` or equivalent hidden styling to the native input.
- Disable the affordance visually while disconnected or uploading.

Do not introduce a modal, drag-and-drop zone, or large upload card. This is a
dense sidebar control.

**Verify**: `pnpm --filter web typecheck` -> exits 0.

### Step 3: Surface in-progress state

While `uploadingReplay` is true:

- show a compact status line such as `Uploading replay...`;
- disable the replay upload affordance;
- disable `Send` if needed only to avoid confusing simultaneous state reset, but do not disable simulator controls unless the current code path requires it;
- keep `Clear all` behavior unchanged.

Use visible text, not a toast. Toasts remain warnings/errors only.

**Verify**: `pnpm --filter web test` -> exits 0.

### Step 4: Reset file input value after each upload attempt

When the file input changes, call `controller.uploadReplay(...)` and then clear
the input value so choosing the same file again triggers another `change` event:

```ts
onChange={(event) => {
  void controller.uploadReplay(event.target.files?.[0] ?? null);
  event.currentTarget.value = "";
}}
```

If TypeScript complains about assigning `value`, use the standard input element
type already inferred from the event.

**Verify**: `pnpm --filter web typecheck` -> exits 0.

### Step 5: Add/adjust E2E coverage

In `apps/web/tests/e2e/workstation.spec.ts`, update the replay upload test so
it still uses the accessible label:

```ts
await page.getByLabel("Replay fixture").setInputFiles("../../data/samples/v1_messages.jsonl");
```

Add an assertion that either:

- `Uploading replay...` appears before final success, if Playwright reliably
  observes it; or
- the upload control is disabled during an intercepted slow request.

Prefer deterministic route interception if needed:

- intercept `**/samples/replay`;
- delay fulfillment briefly;
- assert uploading state is visible;
- then continue/fulfill with a valid response only if this can be done without
  duplicating too much backend response shape.

If deterministic interception becomes too brittle, keep this to a component-level
observable status and do not force a flaky E2E. The successful replay E2E must
remain.

**Verify**: `pnpm --filter web test:e2e -- tests/e2e/workstation.spec.ts` -> exits 0.

### Step 6: Update frontend docs

Update `docs/frontend.md`:

- move replay upload polish and in-progress state out of the future backlog;
- document the current replay upload behavior as a compact button/label control
  with visible uploading/success/error status;
- keep any remaining future replay items only if something is intentionally
  deferred.

**Verify**: `rg -n "Replay upload|uploading|Future UI Backlog|Replay fixture" docs/frontend.md` -> docs reflect the implemented state.

## Test plan

- Typecheck the web package after hook/component changes.
- Existing Vitest tests remain passing.
- Existing replay E2E remains passing.
- Add or update E2E for upload in-progress state only if it can be deterministic.

## Done criteria

ALL must hold:

- [ ] `useWorkstation()` exposes `uploadingReplay`.
- [ ] `uploadReplay()` sets uploading state before clear/post and resets it in `finally`.
- [ ] Duplicate upload attempts during an active upload are ignored or disabled.
- [ ] Replay upload uses a compact button/label affordance while preserving native file input behavior.
- [ ] The same file can be uploaded again after a failed or successful attempt.
- [ ] Uploading, success, and error states are visible inline.
- [ ] No success toast is added.
- [ ] `pnpm --filter web test` exits 0.
- [ ] `pnpm --filter web typecheck` exits 0.
- [ ] `pnpm --filter web lint` exits 0.
- [ ] `pnpm --filter web test:e2e -- tests/e2e/workstation.spec.ts` exits 0.
- [ ] `docs/frontend.md` no longer lists replay upload polish and in-progress state as future backlog.
- [ ] No files outside the in-scope list are modified except `plans/README.md` status.

## STOP conditions

Stop and report if:

- Preserving accessible native file behavior requires a broader UI primitive
  change outside the replay controls.
- Upload in-progress E2E is flaky after one deterministic route-interception
  attempt; do not add unstable tests.
- Backend replay semantics or error response shape need changes beyond Plan 013.
- The change starts affecting unrelated simulator, sidebar, or book workflows.

## Maintenance notes

This plan keeps replay upload compact and sidebar-native. If future work adds a
larger sample library or replay history, design that as a separate feature
rather than expanding this button into a card-heavy upload manager. Reviewers
should verify keyboard access, visible focus, and that the native input remains
usable through Playwright and real browsers.
