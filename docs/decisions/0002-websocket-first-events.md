# ADR 0002: WebSocket-First Event Stream

## Status

Accepted.

## Context

The workstation must update in real time as chat messages become quote events and book changes.

## Decision

V1 uses WebSocket events for live bidirectional interaction. HTTP remains for health and sample replay upload.

## Consequences

- Frontend gets real-time updates without polling.
- Backend remains the owner of domain pipeline and state.
- Integration tests must cover WebSocket event flow.
