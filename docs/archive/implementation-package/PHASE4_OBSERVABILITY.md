# Phase 4: Observability — Metrics & Health

## 1. Summary

Phase 4 adds an observability layer on top of the existing Gorky pipeline (Phases 1–3) without redesigning prior logic. It provides:

- **Runtime metrics**: in-process counters, gauges, and histograms.
- **Health checks**: process, state store, audit logger, cursor, recent poll success, backlog/stuck.
- **Structured correlation**: optional context fields for logs (event_id, mention_id, skip_reason, etc.).
- **Visibility**: publish/skip/block, state store, budget gate, poll/fetch, restart/recovery.

## 2. Files Created

| File | Purpose |
|------|--------|
| `src/observability/metricTypes.ts` | Metric names (counters, gauges, histograms) and snapshot type |
| `src/observability/metrics.ts` | In-process registry: increment, set, observe, getSnapshot, reset |
| `src/observability/health.ts` | Health status (healthy/degraded/unhealthy), runHealthChecks, recordPollSuccess |
| `src/observability/observabilityContext.ts` | Correlation fields for logging |
| `src/observability/index.ts` | Re-exports |
| `tests/observability/metrics.test.ts` | Metrics emission and snapshot |
| `tests/observability/health.test.ts` | Health status transitions |

## 3. Files Updated (minimal hooks)

| File | Change |
|------|--------|
| `src/canonical/auditLog.ts` | getAuditBufferSize(); flush success/failure counters; audit_buffer_size gauge |
| `src/utils/robustFetch.ts` | fetch_retry_total, fetch_rate_limited_total, fetch_duration_ms |
| `src/worker/pollMentions.ts` | mentions_* / publish_* counters; gauges (poll interval, failure streak); recordPollSuccess; setHealthDeps; mention_processing_duration_ms, publish_duration_ms |
| `src/state/eventStateStore.ts` | publish_duplicate_prevented_total on duplicate skip |
| `src/state/sharedBudgetGate.ts` | llm_budget_block_total; llm_budget_used / llm_budget_remaining gauges |
| `src/state/fileSystemStore.ts` | state_store_error_total on save failure |
| `src/state/redisStore.ts` | state_store_error_total in each catch |
| `src/utils/cursorPersistence.ts` | last_cursor_age_seconds on load/save |

## 4. Metrics Design

- **Counters**: monotonically increasing (mentions_seen_total, publish_success_total, etc.).
- **Gauges**: current value (audit_buffer_size, current_poll_interval_ms, llm_budget_used, recent_failure_streak, last_cursor_age_seconds).
- **Histograms**: samples for duration (fetch_duration_ms, publish_duration_ms, mention_processing_duration_ms). state_store_operation_duration_ms and llm_generation_duration_ms are defined; callers can record when those operations occur.

All names live in `metricTypes.ts`. No external metrics system is required; the layer is in-process and testable. In multi-worker deployments, metrics are per-process; aggregate at scrape/ingestion time if needed. The histograms `state_store_operation_duration_ms` and `llm_generation_duration_ms` have no built-in emission sites; callers should observe them when performing those operations.

## 5. Health Design

- **healthy**: All checks pass.
- **degraded**: Non-critical issues (e.g. no poll success yet, elevated audit buffer, moderate failure streak).
- **unhealthy**: Critical (e.g. state store unreachable, poll stale, high failure streak).

Checks: process_alive, state_store_reachable, audit_logger_healthy (buffer size), cursor_state_loadable, recent_poll_success, backlog_stuck (failure streak). State store reachability covers Redis when `USE_REDIS` is set. Dependencies (getAuditBufferSize, loadCursor) are injected via setHealthDeps so the worker can wire them at startup.

## 6. Correlation Fields

`observabilityContext` holds optional fields: event_id, mention_id, user_id, launch_mode, state_store_backend, retry_count, skip_reason, pattern. Use setObservabilityContext / getCorrelationFieldsForLog to attach them to structured logs where useful.

## 7. Test Plan

- **metrics.test.ts**: Increment counters, set gauges, observe histograms; getSnapshot includes all names; resetMetrics clears state.
- **health.test.ts**: With deps set and recordPollSuccess, status is healthy; without poll success, recent_poll_success is degraded; high failure streak makes backlog_stuck unhealthy; large audit buffer makes audit check degraded.

Run: `npm test -- tests/observability`

## 8. Instrumentation Pitfall to Avoid

**Note:** eventState (in-memory) was removed; eventStateStore is the single path. No duplicate counter increments.

## 9. Build Order (first 10 files)

1. `src/observability/metricTypes.ts`
2. `src/observability/metrics.ts`
3. `src/observability/health.ts`
4. `src/observability/observabilityContext.ts`
5. `src/observability/index.ts`
6. `src/canonical/auditLog.ts` (update)
7. `src/utils/robustFetch.ts` (update)
8. `src/state/eventStateStore.ts` (single source)
9. `src/state/sharedBudgetGate.ts` (update)
10. `src/worker/pollMentions.ts` (update)

Then: fileSystemStore, redisStore, cursorPersistence, eventStateStore; tests; doc.

## 10. Final Checklist

- [x] Counters: mentions_*, llm_budget_block, publish_*, fetch_retry/rate_limited, recovery_restart, audit_flush_*, state_store_error
- [x] Gauges: audit_buffer_size, current_poll_interval_ms, llm_budget_used/remaining, recent_failure_streak, last_cursor_age_seconds
- [x] Histograms: fetch_duration_ms, publish_duration_ms, mention_processing_duration_ms (state_store_operation_duration_ms and llm_generation_duration_ms defined for caller use)
- [x] Health: process, state store, audit buffer, cursor loadable, recent poll success, backlog/stuck
- [x] Correlation context API
- [x] Minimal hooks only; no redesign of Phase 1–3 logic
- [x] Tests for metrics and health
