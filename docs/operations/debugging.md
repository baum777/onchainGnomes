# Debugging Guide

## Enable Debug Mode

Set `DEBUG=true` in environment for:
- Full prompt logging
- AI response logging
- Console-friendly log format (vs JSON)

## Decision Tracing

Each workflow execution logs a decision chain:
- classify: action type, confidence
- context: thread length, user history
- ai_decide: prompt version, model
- validate: checks passed
- execute: success/failure

Check logs with `decision_chain` key in debug mode.

## Common Issues

### Duplicate actions
Check StateStore/event-state: events are deduplicated by ID via the persisted event state (processed/published markers). In Redis mode this is shared across processes; in filesystem mode it is single-instance.

### Rate limit errors
Rate limits are enforced by the runtime rate limiter backend. Verify:
- `USE_REDIS=true` + valid `KV_URL` when running multi-worker
- `RATE_LIMIT_BACKEND` (if set) matches your deployment intent

If you need to reset limits for debugging, prefer resetting the StateStore keys in a controlled way (Redis namespace via `REDIS_KEY_PREFIX`) rather than SQL.

### xAI errors
Verify `XAI_API_KEY` is set. Check for 429 (rate limit) - retries happen automatically.

### X API errors
Verify OAuth credentials. 401 = auth problem. 429 = rate limit.
