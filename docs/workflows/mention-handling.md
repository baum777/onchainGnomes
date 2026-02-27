# Mention Handling Workflow

## Trigger

When the bot receives an @mention via X API.

## Flow

1. **Normalize** - Convert X API tweet payload to NormalizedEvent
2. **Classify** - Determine action type (REPLY for mentions)
3. **Build Context** - Load conversation history if in thread
4. **Decide** - xAI generates reply using mentions.yaml prompt
5. **Validate** - Check deduplication, cooldowns, thread limits
6. **Execute** - Post reply via X API (or simulate in dry-run)
7. **Persist** - Mark event processed, update cooldowns
8. **Observe** - Log and record metrics

## Rate Limits

- Per-user reply cooldown: 5 minutes
- Per-thread max replies: 3
- Global posting cooldown: 15 minutes

## Error Handling

- Duplicate: Abort, no action
- Rate limit: Abort, log warning
- API error: Retry with exponential backoff (max 3)
