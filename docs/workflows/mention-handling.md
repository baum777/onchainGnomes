# Mention Handling Workflow

> **Note:** This is a high-level workflow description. For the authoritative runtime path, see the canonical pipeline and worker flow in `src/` and the docs indices: `docs/architecture/` and `docs/operations/runbook.md`.

## Trigger

When the bot receives an @mention via X API.

## Flow

1. **Normalize** - Convert X API tweet payload to NormalizedEvent
2. **Classify** - Determine action type (REPLY for mentions)
3. **Build Context** - Load conversation history if in thread
4. **Decide** - Generate reply via the canonical prompt builder / LLM client
5. **Validate** - Check deduplication, safety gates, and posting policy
6. **Execute** - Post reply via X API (or simulate in dry-run)
7. **Persist** - Mark event processed, update cooldowns
8. **Observe** - Log and record metrics

## Rate Limits

Rate limiting and posting policy are enforced by the runtime rate limiter and launch gate; exact thresholds are config- and deployment-dependent.

## Error Handling

- Duplicate: Abort, no action
- Rate limit: Abort, log warning
- API error: Retry with exponential backoff (max 3)
