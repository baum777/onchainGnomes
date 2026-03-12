/**
 * Phase 4 — Metric type definitions and names.
 * All metric names and value shapes used by the observability layer.
 */

export const COUNTER_NAMES = {
  MENTIONS_SEEN_TOTAL: "mentions_seen_total",
  MENTIONS_PROCESSED_TOTAL: "mentions_processed_total",
  MENTIONS_SKIPPED_TOTAL: "mentions_skipped_total",
  MENTIONS_BLOCKED_TOTAL: "mentions_blocked_total",
  MENTIONS_FAILED_TOTAL: "mentions_failed_total",
  LLM_BUDGET_BLOCK_TOTAL: "llm_budget_block_total",
  PUBLISH_ATTEMPT_TOTAL: "publish_attempt_total",
  PUBLISH_SUCCESS_TOTAL: "publish_success_total",
  PUBLISH_FAILURE_TOTAL: "publish_failure_total",
  PUBLISH_DUPLICATE_PREVENTED_TOTAL: "publish_duplicate_prevented_total",
  FETCH_RETRY_TOTAL: "fetch_retry_total",
  FETCH_RATE_LIMITED_TOTAL: "fetch_rate_limited_total",
  RECOVERY_RESTART_TOTAL: "recovery_restart_total",
  AUDIT_FLUSH_SUCCESS_TOTAL: "audit_flush_success_total",
  AUDIT_FLUSH_FAILURE_TOTAL: "audit_flush_failure_total",
  STATE_STORE_ERROR_TOTAL: "state_store_error_total",
  POLL_LOCK_ACQUIRED_TOTAL: "poll_lock_acquired_total",
  POLL_LOCK_FAILED_TOTAL: "poll_lock_failed_total",
  // Tool-specific counters (NEW)
  TOOL_CALL_TOTAL: "tool_call_total",
  TOOL_SUCCESS_TOTAL: "tool_success_total",
  TOOL_FAILURE_TOTAL: "tool_failure_total",
  POLICY_REJECTION_TOTAL: "policy_rejection_total",
  VERIFICATION_VERIFIED_TOTAL: "verification_verified_total",
  VERIFICATION_UNVERIFIED_TOTAL: "verification_unverified_total",
  VERIFICATION_DEGRADED_TOTAL: "verification_degraded_total",
} as const;

export const GAUGE_NAMES = {
  AUDIT_BUFFER_SIZE: "audit_buffer_size",
  CURRENT_POLL_INTERVAL_MS: "current_poll_interval_ms",
  LLM_BUDGET_USED: "llm_budget_used",
  LLM_BUDGET_REMAINING: "llm_budget_remaining",
  RECENT_FAILURE_STREAK: "recent_failure_streak",
  LAST_CURSOR_AGE_SECONDS: "last_cursor_age_seconds",
  // Tool-specific gauges (NEW)
  VERIFICATION_QUEUE_SIZE: "verification_queue_size",
  CIRCUIT_BREAKER_STATE: "circuit_breaker_state",
} as const;

export const HISTOGRAM_NAMES = {
  FETCH_DURATION_MS: "fetch_duration_ms",
  LLM_GENERATION_DURATION_MS: "llm_generation_duration_ms",
  PUBLISH_DURATION_MS: "publish_duration_ms",
  MENTION_PROCESSING_DURATION_MS: "mention_processing_duration_ms",
  STATE_STORE_OPERATION_DURATION_MS: "state_store_operation_duration_ms",
  // Tool-specific histograms (NEW)
  TOOL_LATENCY_MS: "tool_latency_ms",
  VERIFICATION_PIPELINE_DURATION_MS: "verification_pipeline_duration_ms",
} as const;

export type CounterName = (typeof COUNTER_NAMES)[keyof typeof COUNTER_NAMES];
export type GaugeName = (typeof GAUGE_NAMES)[keyof typeof GAUGE_NAMES];
export type HistogramName = (typeof HISTOGRAM_NAMES)[keyof typeof HISTOGRAM_NAMES];

export interface MetricsSnapshot {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, number[]>;
}
