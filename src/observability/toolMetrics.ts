/**
 * Tool Metrics Module
 *
 * Provides specialized metrics tracking for tool calls, verification status,
 * and pipeline performance. Integrates with the base metrics system.
 */

import {
  incrementCounter,
  observeHistogram,
  setGauge,
  recordDuration,
} from "./metrics.js";
import {
  COUNTER_NAMES,
  GAUGE_NAMES,
  HISTOGRAM_NAMES,
  type CounterName,
  type GaugeName,
  type HistogramName,
} from "./metricTypes.js";
import type { ToolName, VerificationStatus, ToolErrorCode } from "../types/tools.js";

// =============================================================================
// Tool Call Metrics
// =============================================================================

/**
 * Record a tool call attempt
 */
export function recordToolCall(tool: ToolName, method: string): void {
  incrementCounter(COUNTER_NAMES.TOOL_CALL_TOTAL);
  // Also track per-tool calls via labels (when supported)
  // For now, we use a single counter
}

/**
 * Record a successful tool execution
 */
export function recordToolSuccess(tool: ToolName, latencyMs: number): void {
  incrementCounter(COUNTER_NAMES.TOOL_SUCCESS_TOTAL);
  observeHistogram(HISTOGRAM_NAMES.TOOL_LATENCY_MS, latencyMs);
}

/**
 * Record a failed tool execution
 */
export function recordToolFailure(tool: ToolName, errorCode: ToolErrorCode): void {
  incrementCounter(COUNTER_NAMES.TOOL_FAILURE_TOTAL);
}

/**
 * Record tool latency (for detailed tracking)
 */
export function recordToolLatency(tool: ToolName, latencyMs: number): void {
  observeHistogram(HISTOGRAM_NAMES.TOOL_LATENCY_MS, latencyMs);
}

// =============================================================================
// Policy Metrics
// =============================================================================

/**
 * Record a policy rejection
 */
export function recordPolicyRejection(
  rejectionType: "INVALID_CA" | "SPOOF_DETECTED" | "SANITIZATION_FAILED"
): void {
  incrementCounter(COUNTER_NAMES.POLICY_REJECTION_TOTAL);
}

// =============================================================================
// Verification Metrics
// =============================================================================

/**
 * Record verification result by status
 */
export function recordVerificationResult(status: VerificationStatus): void {
  switch (status) {
    case "VERIFIED":
      incrementCounter(COUNTER_NAMES.VERIFICATION_VERIFIED_TOTAL);
      break;
    case "UNVERIFIED":
      incrementCounter(COUNTER_NAMES.VERIFICATION_UNVERIFIED_TOTAL);
      break;
    case "DEGRADED":
      incrementCounter(COUNTER_NAMES.VERIFICATION_DEGRADED_TOTAL);
      break;
  }
}

/**
 * Record verification pipeline duration
 */
export function recordVerificationPipelineDuration(durationMs: number): void {
  observeHistogram(HISTOGRAM_NAMES.VERIFICATION_PIPELINE_DURATION_MS, durationMs);
}

/**
 * Update verification queue size gauge
 */
export function setVerificationQueueSize(size: number): void {
  setGauge(GAUGE_NAMES.VERIFICATION_QUEUE_SIZE, size);
}

// =============================================================================
// Circuit Breaker Metrics
// =============================================================================

/**
 * Update circuit breaker state gauge
 * @param state 0 = CLOSED, 1 = HALF_OPEN, 2 = OPEN
 */
export function setCircuitBreakerState(state: 0 | 1 | 2): void {
  setGauge(GAUGE_NAMES.CIRCUIT_BREAKER_STATE, state);
}

// =============================================================================
// Convenience API
// =============================================================================

/**
 * Tool metrics collection API
 */
export const toolMetrics = {
  // Tool calls
  recordToolCall,
  recordToolSuccess,
  recordToolFailure,
  recordToolLatency,

  // Policy
  recordPolicyRejection,

  // Verification
  recordVerificationResult,
  recordVerificationPipelineDuration,
  setVerificationQueueSize,

  // Circuit breaker
  setCircuitBreakerState,
};

// =============================================================================
// Event Logging (Structured)
// =============================================================================

/**
 * Log a tool call event (structured)
 */
export function logToolCallEvent(params: {
  requestId: string;
  tool: ToolName;
  method: string;
  phase: string;
  arguments?: unknown;
}): void {
  const event = {
    timestamp: new Date().toISOString(),
    level: "info",
    event: "tool_call",
    ...params,
  };
  // In production, this would go to a structured logger
  // For now, we just ensure the event structure is correct
  if (process.env.NODE_ENV === "development") {
     
    console.log(JSON.stringify(event));
  }
}

/**
 * Log a tool result event (structured)
 */
export function logToolResultEvent(params: {
  requestId: string;
  tool: ToolName;
  success: boolean;
  resultSummary: string;
  latencyMs: number;
  evidenceSource?: string;
}): void {
  const event = {
    timestamp: new Date().toISOString(),
    level: params.success ? "info" : "warn",
    event: "tool_result",
    ...params,
  };
  if (process.env.NODE_ENV === "development") {
     
    console.log(JSON.stringify(event));
  }
}

/**
 * Log a verification result event (structured)
 */
export function logVerificationResultEvent(params: {
  requestId: string;
  ca: string;
  status: VerificationStatus;
  onchainSuccess: boolean;
  marketSuccess: boolean;
  flags: string[];
}): void {
  const event = {
    timestamp: new Date().toISOString(),
    level: params.status === "VERIFIED" ? "info" : "warn",
    event: "verification_result",
    ...params,
  };
  if (process.env.NODE_ENV === "development") {
     
    console.log(JSON.stringify(event));
  }
}

/**
 * Log a policy rejection event (structured)
 */
export function logPolicyRejectionEvent(params: {
  requestId: string;
  rejectionType: "INVALID_CA" | "SPOOF_DETECTED" | "SANITIZATION_FAILED";
  reason: string;
  originalText?: string;
}): void {
  const event = {
    timestamp: new Date().toISOString(),
    level: "warn",
    event: "policy_rejection",
    ...params,
  };
  if (process.env.NODE_ENV === "development") {
     
    console.log(JSON.stringify(event));
  }
}

/**
 * Structured event logging API
 */
export const toolEventLogger = {
  logToolCall: logToolCallEvent,
  logToolResult: logToolResultEvent,
  logVerificationResult: logVerificationResultEvent,
  logPolicyRejection: logPolicyRejectionEvent,
};
