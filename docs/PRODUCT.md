# Product

## Register

product

## Users

OTC-to-Book is used by quant developers, trading technologists, and market-data engineers reviewing how noisy OTC dealer chat becomes normalized quote events and a consolidated market book. They are in a workstation context: dense information, live updates, and quick verification matter more than narrative explanation.

## Product Purpose

The product demonstrates a deterministic, event-driven OTC quote pipeline. Success means a user can submit or replay broker-style messages, see extraction and validation outcomes, and inspect the resulting bid/ask book without ambiguity about timestamps, quantities, sides, or stale replacement behavior.

## Brand Personality

Trading-desk, precise, restrained.

The interface should feel like a focused market-data tool: compact, legible, and operational. It should not feel like a chatbot, marketing page, generic SaaS dashboard, or decorative AI demo.

## Anti-references

- Marketing landing pages, hero sections, and value-prop layouts.
- Chatbot-first or RAG-style interfaces.
- Decorative gradients, glassmorphism, oversized cards, and playful motion.
- Overly colorful finance dashboards that make inactive information compete with live quotes.
- Interfaces that hide timestamps, units, or event provenance when reviewing market data.

## Design Principles

- Keep the book primary: the consolidated market view is the main work surface.
- Optimize for scanning: quotes, sides, sizes, timestamps, and event status should be readable at a glance.
- Preserve provenance: raw messages and parsed events remain accessible without crowding the book.
- Use density deliberately: compact controls and rows are appropriate when hierarchy stays clear.
- Make state diagnosable: connection, simulator, rejection, active, and superseded states must be explicit.

## Accessibility & Inclusion

Target WCAG AA contrast for text and controls. Do not rely on red/green alone for quote meaning; pair side color with position, labels, or context. Respect reduced-motion preferences. Keep keyboard access for forms, sidebar controls, replay upload, simulator actions, and collapsible panels.
