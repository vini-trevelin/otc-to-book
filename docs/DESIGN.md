---
name: OTC-to-Book
description: Dense OTC quote extraction and market book workstation.
colors:
  background: "oklch(0.145 0 0)"
  foreground: "oklch(0.985 0 0)"
  card: "oklch(0.205 0 0)"
  panel: "#111113"
  panel-strong: "#18181b"
  border: "oklch(1 0 0 / 10%)"
  input: "oklch(1 0 0 / 15%)"
  muted: "oklch(0.269 0 0)"
  muted-foreground: "oklch(0.708 0 0)"
  bid: "#22c55e"
  ask: "#ef4444"
  warning: "#f59e0b"
typography:
  body:
    fontFamily: "Oxanium, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "Oxanium, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "Oxanium, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  none: "0"
  sm: "0"
  md: "0"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  button-primary:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
    rounded: "{rounded.md}"
    height: "28px"
    padding: "0 8px"
  card-panel:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "12px"
---

# Design System: OTC-to-Book

## 1. Overview

**Creative North Star: "Market Tape Workbench"**

The interface is a compact market-data workstation for reviewing live quote extraction, not a storytelling surface. The book owns the center of gravity; side panels support ingestion and audit trails. The system uses a dark, flat, restrained theme because the product is used like an operational trading tool under focused desk conditions.

The visual language should feel precise and calm. Density is acceptable when alignment, contrast, and hierarchy make the next action obvious. Decorative effects, oversized cards, and generic SaaS polish are intentionally avoided.

**Key Characteristics:**

- Dark, flat surfaces with tonal separation instead of shadows.
- Compact controls and quote rows.
- Single-font interface with numeric-friendly character.
- Bid/ask semantics carried by position and restrained color.
- Visible state for connection, simulator, events, active quotes, and superseded quotes.

## 2. Colors

The palette is restrained: neutral dark surfaces carry most of the screen, with green/red reserved for bid/ask semantics.

### Primary

- **Terminal Ink** (`oklch(0.145 0 0)`): page background and deepest surface.
- **Tape White** (`oklch(0.985 0 0)`): primary text and inverted primary controls.

### Secondary

- **Panel Black** (`#111113`): sidebar and book work surfaces.
- **Raised Panel** (`#18181b`): active rows, headers, and emphasized content.

### Tertiary

- **Bid Green** (`#22c55e`): bid-side labels and quote emphasis.
- **Ask Red** (`#ef4444`): ask-side labels and quote emphasis.
- **Warning Amber** (`#f59e0b`): warnings or rejected-state accents when needed.

### Neutral

- **Divider Line** (`oklch(1 0 0 / 10%)`): borders, separators, and low-emphasis outlines.
- **Muted Text** (`oklch(0.708 0 0)`): secondary labels and timestamps.
- **Input Fill** (`oklch(1 0 0 / 15%)`): control backgrounds.

### Named Rules

**The Semantic Accent Rule.** Green and red are for bid/ask semantics only. Do not use them as decorative accents elsewhere.

## 3. Typography

**Display Font:** Oxanium with system sans fallback  
**Body Font:** Oxanium with system sans fallback  
**Label/Mono Font:** Oxanium with system sans fallback

**Character:** The current type system is single-family and technical. It supports compact labels and numeric quote values without introducing marketing-style display hierarchy.

### Hierarchy

- **Display**: Not used. Product screens should avoid hero-scale type.
- **Headline** (600, 0.875rem, 1.4): panel names and important section labels.
- **Title** (600, 0.875rem, 1.4): ticker identifiers and compact headers.
- **Body** (400, 0.75rem, 1.5): dense UI text, message text, and event details.
- **Label** (500, 0.75rem, 1.4): controls, side labels, badges, and metadata.

### Named Rules

**The No Hero Type Rule.** This is a workstation. Headings should make structure legible, not dominate the viewport.

## 4. Elevation

The system is flat by default. Depth is conveyed through tonal layers, borders, and active/inactive opacity rather than drop shadows. Shadows should not be introduced unless a component needs transient elevation for an overlay.

### Named Rules

**The Flat Tape Rule.** Book cards, sidebars, and event rows stay flat. Use contrast, spacing, and border weight before considering elevation.

## 5. Components

### Buttons

- **Shape:** Square industrial corners (`0px` through the current radius token).
- **Primary:** Foreground-on-background inversion for primary action emphasis.
- **Hover / Focus:** Use shadcn/Base UI focus rings and tonal hover changes. Keep transitions short and state-driven.
- **Secondary / Outline / Ghost:** Prefer restrained neutral variants for non-primary controls.

### Cards / Containers

- **Corner Style:** Square to minimal radius.
- **Background:** `card`, `panel`, or `panel-strong` depending on hierarchy.
- **Shadow Strategy:** No shadows at rest.
- **Border:** One-pixel token border for containment.
- **Internal Padding:** Compact spacing between 8px and 16px.

### Inputs / Fields

- **Style:** Dark filled controls with one-pixel border and compact height.
- **Focus:** Token ring plus border change.
- **Error / Disabled:** Use existing shadcn invalid and disabled states; do not invent alternate form vocabulary.

### Navigation

- **Style:** Side panels are utility surfaces. Collapsed states should preserve a small, explicit affordance for expansion.
- **Mobile Treatment:** Side panels should stack or collapse before forcing horizontal overflow.

### Market Book

Book cards are the signature component. The ticker, last update timestamp, bid/ask columns, active quote rows, and superseded quote rows must remain immediately scannable. Quote rows should prioritize price and quantity; broker and timestamp metadata can move to compact secondary placement when space is constrained.

## 6. Do's and Don'ts

### Do:

- **Do** keep the consolidated book visually primary.
- **Do** use 24-hour timestamps for trading-style time display.
- **Do** make scrollbars minimal and theme-consistent.
- **Do** keep sidebars collapsible so the book can occupy more horizontal space.
- **Do** preserve keyboard focus states on all collapsible and form controls.

### Don't:

- **Don't** build a marketing page, chatbot interface, or generic SaaS dashboard.
- **Don't** use decorative gradients, glassmorphism, or large soft shadows.
- **Don't** use colored side-stripe borders as card decoration.
- **Don't** hide units, quote side, event provenance, or timestamp context.
- **Don't** rely on red/green alone to communicate bid and ask.
