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
- step interval control.
- start/stop.

Chat panel should look like real broker chat: timestamp, broker, message text, status.

Current chat behavior:

- Left panel groups controls as Connect, Simulate, Insert, and Chat.
- Connect is a muted placeholder for future broker chat integrations.
- Simulate uses a single start/stop button.
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

## E2E Expectations

Meaningful frontend flow requires E2E tests:

- Send user message and see chat + parsed event + book update.
- Start auto simulator and see live events.
- Upload sample replay and see events.
- Verify stale row muting after same broker/instrument/side replacement.

## Future UI Backlog

These are deferred design/UX items, not active scope:

- Add keyboard accelerators for send, simulator toggle, sidebar collapse, and event reveal.
- Add a compact event/provenance hint near the book or after message send, without making the right sidebar visible by default.
- Polish replay upload into a quieter button/label control while preserving native file behavior.
- Add replay upload in-progress state.
- Consider flattening empty book skeletons into a single low-emphasis strip if detector-clean placeholders become important.
- Consider clear/reset affordances for raw messages and replay status.
