# ADR 0001: V1 Uses Deterministic Extraction

## Status

Accepted.

## Context

The project may eventually use local or provider LLMs for extraction. V1 examples are template-like and suitable for deterministic parsing.

## Decision

V1 uses a deterministic quote extractor behind a `QuoteExtractor` abstraction. LLM extraction is represented only as a future adapter shape.

## Consequences

- Parser behavior is reproducible.
- Parser tests can be precise.
- Confidence/rejection semantics are explicit.
- Future LLM fallback can be added without changing downstream validation or book logic.
