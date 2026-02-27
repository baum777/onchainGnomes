# Autonomous Posting Workflow

## Status

Not yet implemented.

## Planned Flow

1. Scheduler triggers at configured interval
2. Load posting prompt (posting.yaml)
3. Generate content via xAI
4. Validate global posting cooldown
5. Execute post
6. Persist state

## Configuration

- `scheduler_interval_seconds` - How often to check for posting
- Cooldown: 15 minutes between autonomous posts
