# Frontend Plan

## UI Goal

Build a trading-style workstation, not a marketing page.

Layout:

- Left: broker chat simulator.
- Center: consolidated book by ticker.
- Right: parsed quote event and rejection feed.

Current shell decisions:

- Left sidebar defaults visible and can collapse to a compact indicator.
- Right event sidebar defaults hidden and is revealed from the right edge.
- Center book is the primary surface and uses a responsive two-column card grid when space allows.
- Sidebars support the book; they should stay visually quieter than active bid/ask data.

## Chat Panel

Modes:

- User mode: type and send messages.
- User mode replay: upload JSON/CSV sample messages.
- Auto mode: backend-generated broker chat.

Auto controls:

- randomness meter: 1 to 5.
- noise rate stepper.
- chaos rate stepper.
- ticker typo rate stepper.
- template noise rate stepper.
- step interval control.
- start/stop.

Chat panel should look like real broker chat: timestamp, broker, message text, status.

Current chat behavior:

- Left panel groups controls as Connect, Simulate, Insert, and Chat.
- Connect is a muted placeholder for future broker chat integrations.
- Simulate uses a single start/stop button.
- Simulate exposes backend-owned chaos controls for evaluation data generation; the browser only sends rates and does not classify tickers.
- Chat feed has a fixed-height scroll area; raw messages must not grow the sidebar indefinitely.
- Empty/future-state placeholders use static shadcn-style skeletons with muted contrast.

## Book Panel

Per ticker:

- Ticker card header shows the normalized ticker and latest update timestamp.
- Left/right side columns show `BID` and `ASK`.
- Best active quote appears at the top of its side column.
- Active rows visually primary.
- Stale/superseded rows visually muted.
- Row content stays compact: price, size, broker, received timestamp.
- Status is encoded by color/opacity instead of repeated text.

Current book behavior:

- Center container has no title; each book card owns its ticker header.
- Book rows show price, quantity, broker, and 24-hour timestamp.
- Row ladders are capped visually and scroll internally without visible scrollbars.
- Empty book state explains the pipeline: raw message, parsed event, active bid/ask row.

## Event Panel

Show latest:

- parsed quote candidates.
- accepted quote events.
- rejected/noise messages with reasons.

Current event behavior:

- Parsed events remain accessible but hidden by default to preserve a book-first workstation.
- The right edge reveal is intentionally subtle; do not expand it into a persistent full sidebar by default without a new design decision.
- Event provenance can be secondary, but it must remain discoverable from the workstation.

## State Handling

Frontend consumes backend WebSocket events and keeps local UI state only for rendering. Domain decisions remain in backend.

Required UI states:

- connecting.
- connected.
- disconnected/retry.
- simulator running/stopped.
- upload success/failure.
- empty book.
- rejected/noise messages.

## Future Extraction Controls

Future fuzzy or LLM extraction controls are frontend control-plane features only.
The dashboard may show current extraction mode, provider health, latency,
confidence, and backend-advertised provider profiles. It must not perform quote
extraction in the browser, hold provider API keys, or submit arbitrary model
server URLs. Any future API key workflow needs a separate backend-owned secret
design before UI implementation.

Simulator chaos controls are separate from extraction controls. They may expose
backend simulator settings such as chaos, ticker typo, and template noise rates,
but they must only send simulator config to the backend.

## E2E Expectations

Meaningful frontend flow requires E2E tests:

- Send user message and see chat + parsed event + book update.
- Start auto simulator and see live events.
- Verify stale row muting after same broker/instrument/side replacement.

Replay upload E2E coverage is still needed. Current replay behavior is implemented, but upload is not yet covered by the Playwright suite.

## Component Pattern Diagnosis

Current accepted exceptions:

- `Input` is a native input wrapper with `suppressHydrationWarning`. This is out of pattern with fully composed Base UI field primitives, but it is currently accepted because browser/extensions can mutate input styles before hydration.
- `NativeSelect` uses a native select plus a Tabler selector icon. This matches the current lightweight workstation style and avoids unnecessary select complexity.
- `RightEdgeIndicator` is a bespoke hidden event-panel affordance. It is intentionally quieter than a collapsed sidebar container.
- `BookQuoteRow` is a domain-specific market-data row, not a generic card/table abstraction.
- Title-hover help uses shadcn/Base UI tooltip behavior without visible subtitle text or a `?` icon, per the current design decision.

Items to revisit when polishing:

- Replay upload still presents as a native file input; it should become a quieter button/label control while preserving native behavior.
- Slider thumb styling contains a hardcoded white surface; this is acceptable in the current dark-only theme but should move to tokens if theme variability returns.
- Empty book skeletons sit inside a dashed placeholder container. This is low-risk now, but can be flattened if the placeholder visual weight becomes too high.

## Future UI Backlog

These are deferred design/UX items, not active scope. Order reflects current priority.

1. Add replay upload E2E coverage.
   Acceptance: Playwright uploads a sample file, verifies events/book updates, and covers visible failure or status behavior.
2. Add keyboard accelerators for send, simulator toggle, sidebar collapse, and event reveal.
   Acceptance: shortcuts are documented in UI-facing docs and covered by interaction or E2E tests.
3. Add a compact event/provenance hint near the book or after message send, without making the right sidebar visible by default.
   Acceptance: users can discover parsed events from the book-first layout, and the right sidebar still defaults hidden.
4. Polish replay upload into a quieter button/label control while preserving native file behavior.
   Acceptance: upload affordance aligns with compact controls and keeps visible success/failure feedback.
5. Add replay upload in-progress state.
   Acceptance: uploading cannot appear idle while processing.
6. Consider clear/reset affordances for raw messages and replay status.
   Acceptance: reset behavior is explicit and does not erase book state accidentally.
7. Consider flattening empty book skeletons into a single low-emphasis strip if detector-clean placeholders become important.
   Acceptance: empty state remains understandable without reading as a nested card.
