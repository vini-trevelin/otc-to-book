# Dashboard Critique - Skeleton Placeholder Pass - 2026-06-20

Target: `apps/web/app/page.tsx` / `http://localhost:3000/`

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Connection, simulator, timestamps, upload errors, and empty feed states are visible; long-running replay progress still has no active loading state. |
| 2 | Match System / Real World | 4 | Dense book-first layout, 24-hour timestamps, broker IDs, and bid/ask semantics remain domain-native. |
| 3 | User Control and Freedom | 3 | Sidebars collapse and simulator can stop; no clear/reset path for raw messages or replay state. |
| 4 | Consistency and Standards | 3 | Skeleton primitive now aligns placeholders with shadcn conventions; right-edge event reveal remains a deliberately custom affordance. |
| 5 | Error Prevention | 3 | Replay failures now explain likely causes; manual message input still accepts invalid/noisy text without preview. |
| 6 | Recognition Rather Than Recall | 3 | Empty states now show the expected data shape; hidden event panel and title-only help still require discovery. |
| 7 | Flexibility and Efficiency | 2 | Core flow works, but there are no power-user accelerators for send, simulation, panel toggles, or book navigation. |
| 8 | Aesthetic and Minimalist Design | 3 | Skeletons make placeholders more operational and less blank; empty-state preview is close to looking like a nested mini-dashboard. |
| 9 | Error Recovery | 3 | Replay/API recovery copy improved; parsed validation failures still rely on opening events. |
| 10 | Help and Documentation | 3 | Tooltip affordance and empty-state guidance are clearer; no task-level quick reference yet. |
| **Total** | | **30/40** | **Good: stronger workstation surface, remaining gaps are efficiency and audit discoverability.** |

## Anti-Patterns Verdict

This continues to avoid generic AI-dashboard tells. The dashboard reads as a restrained market-data workstation rather than a SaaS demo: no decorative gradients, no glass, no hero metrics, no ornamental color.

The skeleton pass improved the empty state. Previously the first screen was mostly blank panels and instructional text. Now the placeholders describe the shape of the future book and raw feed, which makes the UI feel more deliberate.

Deterministic scan:

- CLI detector on `apps/web/app/page.tsx` and `apps/web/components/ui/skeleton.tsx`: clean, `[]`.
- Browser overlay on `http://localhost:3000/`: 3 findings.
- Overlay labels captured: `nested cards` and duplicate `flat type hierarchy: Sizes: 10px, 11px, 12px, 14px, 16px (ratio 1.6:1)`.

False-positive context: the type scale is intentionally compact for a workstation. The nested-card finding now points mainly at skeleton previews inside dashed empty-state containers. That is less problematic than nested live cards, but the warning is still useful: placeholder previews should stay subdued enough not to become a second dashboard inside the dashboard.

## Overall Impression

The surface is now in a good working zone. Empty states explain the pipeline, placeholders use a familiar shadcn vocabulary, and the populated book remains visually dominant. The biggest remaining opportunity is not visual polish; it is operator efficiency and diagnosability under real desk workflows.

## What's Working

- Skeleton placeholders now preview the book and message-feed structure without introducing new layout patterns.
- The simulator action is no longer bid-green, so semantic green is preserved for BID data.
- Populated state remains clean: skeletons disappear, quote rows keep broker/timestamp metadata, and the book stays primary.

## Priority Issues

### [P2] Skeleton previews are close to becoming visual content

Why it matters: the book skeletons help teach the future state, but the mini-card composition inside the empty panel can read like an inactive dashboard section rather than a placeholder.

Fix: keep the skeletons, but make the outer empty panel less card-like or reduce the skeleton preview to one representative book instead of two. Another option is to render the skeleton as a single full-width book strip.

Suggested command: `$impeccable layout`

### [P2] Operator efficiency is still underdeveloped

Why it matters: quant/dev users will repeat send, simulate, inspect event, and collapse/expand flows. Without accelerators, the interface remains demo-efficient rather than workstation-efficient.

Fix: add keyboard shortcuts and visible shortcut hints for send, simulator toggle, left collapse, and event reveal. Keep hints muted and local to controls.

Suggested command: `$impeccable optimize`

### [P2] Audit trail is intentionally hidden, but still a workflow cost

Why it matters: the right panel staying hidden is accepted, but parsed events are still the only way to diagnose extraction/replay details. Users must know where to look.

Fix: keep right default hidden, but surface a compact inline event count/status near the book empty state or after message send, without changing the right rail affordance itself.

Suggested command: `$impeccable clarify`

### [P3] Replay upload still feels heavier than its importance

Why it matters: the native file input consumes width and visual weight in the left rail. It is acceptable, but less polished than the surrounding controls.

Fix: replace the visible file input with a compact shadcn-style button row that preserves native file behavior behind a label.

Suggested command: `$impeccable polish`

### [P3] Flat type hierarchy remains a detector warning

Why it matters: the compact type scale is correct for this product, but `10px/11px/12px/14px/16px` can make all sidebar sections feel equally important.

Fix: do not introduce hero type. Instead use weight, borders, and state density to separate structural labels from data labels.

Suggested command: `$impeccable typeset`

## Persona Red Flags

### Alex, Power User

Alex can now understand the empty book faster, but repeated operation is still click-heavy. There are no visible shortcuts for sending a message, toggling simulation, or opening parsed events.

### Sam, Accessibility-Dependent User

Decorative skeletons are `aria-hidden`, which is correct. Remaining risk is the invisible right-edge event affordance: keyboard users can reach it, but sighted keyboard users get no resting visual cue until focus/hover.

### Marina, Market-Data Engineer

Marina gets a better first-run explanation of the pipeline, but extraction diagnostics remain behind the hidden event feed. For debugging parser behavior, the UI still makes provenance feel secondary.

## Minor Observations

- The Connect placeholder now benefits from skeletons, but its future-state copy should stay very short because it is not a V1 feature.
- The skeleton animation is subtle enough in desktop screenshots, but it should not be used for long-lived empty states if users mistake it for loading.
- The empty book skeletons use bid/ask color, which is semantically coherent, but keep opacity restrained so they do not compete with real quotes.

## Questions to Consider

- Should empty-state skeletons imply loading, or should they be static previews for this product?
- Is one book skeleton enough, or do two better communicate the expected two-column book grid?
- Should event provenance remain fully hidden until the right rail is opened, or should the center surface expose one compact audit hint?
