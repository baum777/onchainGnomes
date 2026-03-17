# ADR-001: SQLite for MVP State

## Status

Superseded

## Context

Need lightweight persistence for MVP. Requirements:
- Processed event tracking (deduplication)
- Cooldown enforcement
- Conversation tracking
- Minimal operational overhead

## Decision

**Historical decision (superseded):** This repo’s production runtime is TypeScript/Node and uses a StateStore abstraction (Redis or filesystem) for persistence. SQLite/aiosqlite references reflect an earlier design and are kept for historical context.

## Consequences

**Positive**
- Single file deployment
- No separate database server
- Simple backup (copy file)
- Sufficient for single-worker model

**Negative**
- Limits concurrent writes
- Not ideal for multi-worker scaling
- Will need migration path to PostgreSQL for scale

## Future

When scaling to multiple workers or high throughput, migrate to PostgreSQL. Schema is designed to be portable.
