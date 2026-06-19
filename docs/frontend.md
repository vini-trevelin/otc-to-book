# Frontend Plan

## UI Goal

Build a trading-style workstation, not a marketing page.

Layout:

- Left: broker chat simulator.
- Center: consolidated book by ticker.
- Right: parsed quote event and rejection feed.

## Chat Panel

Modes:

- User mode: type and send messages.
- User mode replay: upload JSON/CSV sample messages.
- Auto mode: backend-generated broker chat.

Auto controls:

- randomness meter: 1 to 5.
- noise rate.
- interval.
- start/stop.

Chat panel should look like real broker chat: timestamp, broker, message text, status.

## Book Panel

Per ticker:

- Best bid and best ask at top.
- Ladder rows below.
- Active rows visually primary.
- Stale/superseded rows visually muted.
- Show received timestamp and age.

## Event Panel

Show latest:

- parsed quote candidates.
- accepted quote events.
- rejected/noise messages with reasons.

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
