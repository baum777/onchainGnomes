/**
 * Phase 4 — Health checks: healthy / degraded / unhealthy.
 */

import { getStateStore } from "../state/storeFactory.js";
import { getSnapshot } from "./metrics.js";
import { GAUGE_NAMES } from "./metricTypes.js";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  message?: string;
  durationMs?: number;
}

export interface HealthReport {
  status: HealthStatus;
  checks: HealthCheckResult[];
  timestamp: string;
}

const RECENT_POLL_SUCCESS_GAUGE = "recent_poll_success_timestamp_ms";
let lastPollSuccessMs: number = 0;
const STALE_POLL_MS = 5 * 60 * 1000; // 5 minutes
const AUDIT_BUFFER_DEGRADED = 80;
const AUDIT_BUFFER_UNHEALTHY = 95;
const FAILURE_STREAK_DEGRADED = 2;
const FAILURE_STREAK_UNHEALTHY = 5;

export function recordPollSuccess(): void {
  lastPollSuccessMs = Date.now();
}

/** Reset poll success timestamp (for tests). */
export function resetPollSuccessTimestamp(): void {
  lastPollSuccessMs = 0;
}

async function checkStateStoreReachable(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const store = getStateStore();
    const ok = await store.ping();
    return {
      name: "state_store_reachable",
      status: ok ? "healthy" : "unhealthy",
      message: ok ? undefined : "ping returned false",
      durationMs: Date.now() - start,
    };
  } catch (error) {
    return {
      name: "state_store_reachable",
      status: "unhealthy",
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - start,
    };
  }
}

async function checkAuditBuffer(getBufferSize: () => number): Promise<HealthCheckResult> {
  const size = getBufferSize();
  let status: HealthStatus = "healthy";
  if (size >= AUDIT_BUFFER_UNHEALTHY) status = "unhealthy";
  else if (size >= AUDIT_BUFFER_DEGRADED) status = "degraded";
  return {
    name: "audit_logger_healthy",
    status,
    message: `buffer_size=${size}`,
  };
}

async function checkCursorLoadable(loadCursor: () => Promise<unknown>): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    await loadCursor();
    return {
      name: "cursor_state_loadable",
      status: "healthy",
      durationMs: Date.now() - start,
    };
  } catch (error) {
    return {
      name: "cursor_state_loadable",
      status: "degraded",
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - start,
    };
  }
}

async function checkRecentPollSuccess(): Promise<HealthCheckResult> {
  const now = Date.now();
  const age = now - lastPollSuccessMs;
  if (lastPollSuccessMs === 0) {
    return { name: "recent_poll_success", status: "degraded", message: "no poll success recorded" };
  }
  if (age > STALE_POLL_MS) {
    return {
      name: "recent_poll_success",
      status: "unhealthy",
      message: `last success ${Math.round(age / 1000)}s ago`,
    };
  }
  return { name: "recent_poll_success", status: "healthy" };
}

async function checkBacklogStuck(snapshot: ReturnType<typeof getSnapshot>): Promise<HealthCheckResult> {
  const failureStreak = snapshot.gauges[GAUGE_NAMES.RECENT_FAILURE_STREAK] ?? 0;
  let status: HealthStatus = "healthy";
  if (failureStreak >= FAILURE_STREAK_UNHEALTHY) status = "unhealthy";
  else if (failureStreak >= FAILURE_STREAK_DEGRADED) status = "degraded";
  return {
    name: "backlog_stuck",
    status,
    message: failureStreak > 0 ? `failure_streak=${failureStreak}` : undefined,
  };
}

async function checkProcessAlive(): Promise<HealthCheckResult> {
  return { name: "process_alive", status: "healthy" };
}

const statusOrder: HealthStatus[] = ["healthy", "degraded", "unhealthy"];
function worstStatus(a: HealthStatus, b: HealthStatus): HealthStatus {
  return statusOrder[Math.max(statusOrder.indexOf(a), statusOrder.indexOf(b))]!;
}

export type HealthDeps = {
  getAuditBufferSize: () => number;
  loadCursor: () => Promise<unknown>;
};

let healthDeps: HealthDeps | null = null;

export function setHealthDeps(deps: HealthDeps): void {
  healthDeps = deps;
}

export async function runHealthChecks(): Promise<HealthReport> {
  const snapshot = getSnapshot();
  const checks: HealthCheckResult[] = [];

  checks.push(await checkProcessAlive());
  checks.push(await checkStateStoreReachable());
  checks.push(await checkRecentPollSuccess());
  checks.push(await checkBacklogStuck(snapshot));

  if (healthDeps) {
    checks.push(await checkAuditBuffer(healthDeps.getAuditBufferSize));
    checks.push(await checkCursorLoadable(healthDeps.loadCursor));
  } else {
    checks.push({
      name: "audit_logger_healthy",
      status: "degraded",
      message: "health deps not set",
    });
    checks.push({
      name: "cursor_state_loadable",
      status: "degraded",
      message: "health deps not set",
    });
  }

  const status = checks.reduce<HealthStatus>(
    (acc, c) => worstStatus(acc, c.status),
    "healthy"
  );

  return {
    status,
    checks,
    timestamp: new Date().toISOString(),
  };
}
