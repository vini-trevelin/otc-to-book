---
target: OTC-to-Book dashboard
total_score: 26
p0_count: 0
p1_count: 2
timestamp: 2026-06-20T19-04-54Z
slug: apps-web-app-page-tsx
---
# Dashboard Critique - 2026-06-20

Target: `apps/web/app/page.tsx` / `http://localhost:3000/`

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Connected, simulator, timestamps, and sequence states are visible; upload/reconnect failures are still thin. |
| 2 | Match System / Real World | 4 | The language, bid/ask layout, 24-hour time, and dense tape feel fit the OTC workstation domain. |
| 3 | User Control and Freedom | 3 | Sidebars collapse and simulator can stop; no clear/reset, undo, or easy recovery path for replay/message mistakes. |
| 4 | Consistency and Standards | 3 | Components mostly rhyme; right-panel reveal and title-only tooltip behavior are less discoverable than the rest. |
| 5 | Error Prevention | 2 | Manual message entry and replay upload allow weak inputs with minimal guardrails or preview. |
| 6 | Recognition Rather Than Recall | 2 | Primary controls are visible, but helper copy and parsed events are hidden behind hover/edge interactions. |
| 7 | Flexibility and Efficiency | 2 | Keyboard basics exist, but there are no accelerators for send/start/focus/collapse or book navigation. |
| 8 | Aesthetic and Minimalist Design | 3 | Book-first, restrained, and operational; left rail and empty states still consume more attention than they earn. |
| 9 | Error Recovery | 2 | Failures such as replay upload or WebSocket disconnect do not explain the fix or preserve a diagnostic trail. |
| 10 | Help and Documentation | 2 | Tooltips exist, but they are intentionally invisible until hover and there is no task-level guidance. |
| **Total** | | **26/40** | **Acceptable: strong direction, still needs interaction hardening.** |

## Anti-Patterns Verdict

This no longer reads as generic AI dashboard output. The palette is disciplined, the center book is specific to the domain, and the interface avoids the common SaaS/glass/gradient traps.

The remaining AI-slop risk is structural, not decorative: several areas have the same visual volume regardless of importance, especially the empty raw-message panel and the left sidebar controls. The interface feels credible as a trading-desk tool once populated; the empty state still feels more like a component inventory than an operational workstation.

Deterministic scan:

- CLI detector on `apps/web/app/page.tsx`: clean, `[]`.
- Browser overlay on `http://localhost:3000/`: 3 findings.
- Overlay labels captured: `nested cards` and duplicate `flat type hierarchy: Sizes: 10px, 12px, 14px, 16px (ratio 1.6:1)`.

False-positive context: the flat type hierarchy is partly intentional. The design system says this is a compact workstation with no hero type. Still, the detector is right that the left panel, empty state, and book cards rely heavily on 10-16px text with similar weight, so hierarchy is sometimes carried by borders instead of information priority.

## Overall Impression

The populated dashboard is directionally right: it feels dense, precise, and market-data native. The biggest opportunity is to make the shell behave like a mature workstation instead of a compact demo: controls should recede faster, hidden affordances should remain discoverable, and empty/error states should actively move the user toward the next diagnostic action.

## What's Working

- The book is clearly the primary surface on desktop. Two-card rows, compact quote rows, and subdued side panels support the "Market Tape Workbench" direction.
- Bid/ask semantics are readable without becoming decorative. Position, labels, and restrained red/green work together.
- The quote row metadata is much healthier now: price and quantity lead, broker and timestamp are present without bloating each row.

## Priority Issues

### [P1] Hidden right panel is too hidden

Why it matters: parsed events are critical provenance, but the affordance is an invisible right-edge hover target. Expert users may discover it eventually; first-time users and keyboard/screen-reader users get weaker recognition.

Fix: keep the panel default hidden, but expose a persistent 1-2px edge rail or small vertical "Events" tab that appears at rest without consuming layout width. Preserve the hover reveal, but do not make hover the only visual clue.

Suggested command: `$impeccable clarify`

### [P1] Empty state does not teach the workstation flow

Why it matters: the first screen says "Book empty" and "No messages yet" but does not connect the user's next action to the expected pipeline: insert/simulate -> raw message -> parsed event -> book row.

Fix: replace the center empty card with a compact operational empty state: "Send a broker message or start simulation to build the book." Include one low-emphasis example message or link focus to the manual message field. Keep it dense.

Suggested command: `$impeccable onboard`

### [P2] Left rail hierarchy still overweights controls

Why it matters: on desktop the left rail is acceptable, but the Connect/Simulate/Insert stack visually competes with the book, especially when populated. On mobile, the entire control stack appears before any market data.

Fix: collapse `Insert` by default after the first successful send, make `Connect` visually smaller as a future placeholder, and consider a mobile-first order where the book appears before expanded controls or controls collapse into a top utility bar.

Suggested command: `$impeccable layout`

### [P2] Helper tooltips are correct but under-discoverable

Why it matters: the user requested no visible subtitle and no question icon, so the current title-hover behavior matches instruction. The tradeoff is that nothing tells users the headings carry help.

Fix: add a subtle text affordance that does not add clutter, such as dotted underline on hover/focus only, `cursor-help`, and keyboard focus styling that is visible on the heading text.

Suggested command: `$impeccable harden`

### [P2] Error and recovery states are too generic

Why it matters: a quant/debugging surface must explain failure modes. "Replay failed" and disconnected state do not say whether the issue is file type, backend availability, schema, or validation.

Fix: add compact inline recovery copy for replay failures and websocket disconnects. Preserve raw diagnostic detail in the event panel when available.

Suggested command: `$impeccable harden`

## Persona Red Flags

### Alex, Power User

Alex can submit a message quickly and read the book, but there are no obvious accelerators: no keyboard shortcut for send, simulator start/stop, sidebar toggle, or event panel reveal. Hidden book scroll is visually clean, but heavy books have no fast jump, filter, or "active only" control.

### Sam, Accessibility-Dependent User

Most controls have labels and focusable buttons, which is good. The risk is the invisible right-edge event button: it can receive focus, but it has no resting visual presence. The title-to-tooltip interaction also depends on users discovering that headings are interactive.

### Marina, Market-Data Engineer

Marina wants to verify provenance and stale replacement behavior. The book rows now show broker and time, but parsed events are hidden by default and hard to discover. That makes auditability feel secondary even though it is core to the product purpose.

## Minor Observations

- "Broker Chat" as the left panel title now overlaps semantically with the `Chat` section. "Broker Input" or "Ingestion" would better describe Connect/Simulate/Insert/Chat as a group.
- The file input is visually heavier than its importance. A compact replay button or file row would better match the surrounding controls.
- `Start simulation` uses bright green, which risks violating the semantic accent rule because green is reserved for bid. Consider foreground inversion or neutral primary styling.
- The book-card count values are useful, but they are easy to read as priority numbers. A tiny "rows" label or tooltip could clarify.
- Mobile has no horizontal overflow, but the book is pushed below all controls. For a workstation that may be fine; for demo/review on mobile it weakens the product's first impression.

## Questions to Consider

- Should parsed events be treated as hidden secondary telemetry, or as a first-class audit surface that deserves a persistent rail?
- Is mobile a supported review surface, or should this product explicitly optimize for desktop workstation use?
- Does green on `Start simulation` create semantic confusion with bid-side green?
- Should the first empty state teach the pipeline, or should the product assume the operator already knows to send/simulate?
