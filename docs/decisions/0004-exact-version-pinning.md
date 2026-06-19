# ADR 0004: Exact Version Pinning

## Status

Accepted.

## Context

The repository is intended to be reproducible and portfolio-quality. Floating dependency ranges make builds drift.

## Decision

Every library and tool dependency installed or used by the project must be pinned exactly.

## Consequences

- `package.json` must not contain `^` or `~` ranges.
- Python dependencies use exact `==`.
- Lockfiles are committed.
- Generated dependency ranges must be fixed before continuing.

Commit messages follow `verb: description` so repo history stays scan-friendly.
