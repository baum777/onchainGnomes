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
Check `processed_events` table - events are deduplicated by ID.

### Rate limit errors
Check `cooldowns` table. Per-user cooldown is 5 min.
Clear with: `DELETE FROM cooldowns WHERE type='per_user_reply';`

### xAI errors
Verify `XAI_API_KEY` is set. Check for 429 (rate limit) - retries happen automatically.

### X API errors
Verify OAuth credentials. 401 = auth problem. 429 = rate limit.
