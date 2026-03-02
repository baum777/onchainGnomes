"""Prometheus metrics for observability."""

from prometheus_client import Counter, Histogram, Gauge

# Event processing metrics
events_processed = Counter(
    "bot_events_total",
    "Total events processed",
    ["event_type", "status"],
)

# Workflow execution metrics
workflow_duration = Histogram(
    "bot_workflow_duration_seconds",
    "Workflow execution time",
    ["workflow_type"],
    buckets=(0.1, 0.5, 1.0, 2.0, 5.0, 10.0),
)

# Cooldown metrics
active_cooldowns = Gauge(
    "bot_active_cooldowns",
    "Number of active cooldowns",
)

# Action execution metrics
actions_executed = Counter(
    "bot_actions_total",
    "Total actions executed",
    ["action_type", "success"],
)

# API call metrics
api_calls = Counter(
    "bot_api_calls_total",
    "Total API calls",
    ["service", "endpoint", "status"],
)
