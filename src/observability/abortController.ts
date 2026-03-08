/**
 * Minimal Abort Controller — Production Safety Guard
 *
 * Monitors critical metrics and triggers abort conditions
 * when operational thresholds are exceeded.
 */

import { getSnapshot } from "./metrics.js";
import { COUNTER_NAMES, GAUGE_NAMES } from "./metricTypes.js";
import { logError, logWarn } from "../ops/logger.js";

const ABORT_THRESHOLDS = {
  safetyBlockRatio: 0.01,      // 1% of processed
  failureStreak: 5,            // consecutive failures
  skipRatio: 0.80,             // 80% skips indicates systemic issue
};

export type AbortStatus = "healthy" | "degraded" | "abort";

export interface AbortCheckResult {
  status: AbortStatus;
  triggeredThresholds: string[];
  metrics: {
    safetyBlockRatio: number;
    failureStreak: number;
    skipRatio: number;
  };
}

export function checkAbortConditions(): AbortCheckResult {
  const snapshot = getSnapshot();

  const processed = snapshot.counters[COUNTER_NAMES.MENTIONS_PROCESSED_TOTAL] || 0;
  const blocked = snapshot.counters[COUNTER_NAMES.MENTIONS_BLOCKED_TOTAL] || 0;
  const skipped = snapshot.counters[COUNTER_NAMES.MENTIONS_SKIPPED_TOTAL] || 0;
  const failureStreak = snapshot.gauges[GAUGE_NAMES.RECENT_FAILURE_STREAK] || 0;

  const safetyBlockRatio = processed > 0 ? blocked / processed : 0;
  const skipRatio = processed > 0 ? skipped / processed : 0;

  const triggered: string[] = [];

  if (safetyBlockRatio > ABORT_THRESHOLDS.safetyBlockRatio) {
    triggered.push(`safety_block_ratio:${safetyBlockRatio.toFixed(3)}`);
  }

  if (failureStreak >= ABORT_THRESHOLDS.failureStreak) {
    triggered.push(`failure_streak:${failureStreak}`);
  }

  if (skipRatio > ABORT_THRESHOLDS.skipRatio) {
    triggered.push(`skip_ratio:${skipRatio.toFixed(3)}`);
  }

  let status: AbortStatus = "healthy";
  if (triggered.length >= 2) {
    status = "abort";
  } else if (triggered.length === 1) {
    status = "degraded";
  }

  if (status === "abort") {
    logError("[ABORT_CONTROLLER] Critical thresholds exceeded", {
      triggered,
      metrics: { safetyBlockRatio, failureStreak, skipRatio },
    });
  } else if (status === "degraded") {
    logWarn("[ABORT_CONTROLLER] Degraded threshold triggered", {
      triggered,
      metrics: { safetyBlockRatio, failureStreak, skipRatio },
    });
  }

  return {
    status,
    triggeredThresholds: triggered,
    metrics: { safetyBlockRatio, failureStreak, skipRatio },
  };
}

export function shouldContinueProcessing(): boolean {
  const result = checkAbortConditions();
  return result.status !== "abort";
}
