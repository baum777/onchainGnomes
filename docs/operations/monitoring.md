# Monitoring

## Metrics (Prometheus)

- `bot_events_total` - Events processed by type and status
- `bot_workflow_duration_seconds` - Workflow execution time
- `bot_active_cooldowns` - Active cooldown count
- `bot_actions_total` - Actions by type and success
- `bot_api_calls_total` - API calls by service and status

## Log Levels

- **DEBUG** - Prompts, responses, full context
- **INFO** - Workflow steps, successful actions
- **WARNING** - Rate limits, retries, cooldowns
- **ERROR** - Failed actions, API errors
- **CRITICAL** - Auth failures, data corruption

## Health Checks

`scripts/health_check.py` verifies:
- Database connectivity
- X API client init
- xAI client init
