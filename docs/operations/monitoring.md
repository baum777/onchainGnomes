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

Prefer the built-in HTTP endpoints:
- `GET /health` (full health: store reachable + recent poll success + system signals)
- `GET /ready` (store ping only)
- `GET /metrics` (basic metrics)

Note: the production runtime is TypeScript/Node. Any legacy Python health scripts should be treated as reference-only unless explicitly wired into your deployment.
