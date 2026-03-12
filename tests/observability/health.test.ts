import { describe, it, expect, beforeEach } from "vitest";
import { runHealthChecks, recordPollSuccess, setHealthDeps, resetPollSuccessTimestamp } from "../../src/observability/health.js";
import { setGauge, resetMetrics } from "../../src/observability/metrics.js";
import { GAUGE_NAMES } from "../../src/observability/metricTypes.js";

describe("observability health", () => {
  beforeEach(async () => {
    process.env.USE_REDIS = "false";
    resetMetrics();
    setHealthDeps({
      getAuditBufferSize: () => 0,
      loadCursor: () => Promise.resolve({ since_id: null, last_fetch_at: "", fetched_count: 0, version: 1 }),
    });
    await resetPollSuccessTimestamp();
  });

  it("returns healthy when checks pass", async () => {
    await recordPollSuccess();
    const report = await runHealthChecks();
    expect(report.status).toBe("healthy");
    expect(report.checks.length).toBeGreaterThan(0);
    expect(report.timestamp).toBeDefined();
  });

  it("returns degraded when recent poll never succeeded", async () => {
    await resetPollSuccessTimestamp();
    const report = await runHealthChecks();
    const recentPoll = report.checks.find((c) => c.name === "recent_poll_success");
    expect(recentPoll?.status).toBe("degraded");
  });

  it("returns unhealthy when failure streak is high", async () => {
    await recordPollSuccess();
    setGauge(GAUGE_NAMES.RECENT_FAILURE_STREAK, 10);
    const report = await runHealthChecks();
    const backlog = report.checks.find((c) => c.name === "backlog_stuck");
    expect(backlog?.status).toBe("unhealthy");
  });

  it("returns degraded when audit buffer is large", async () => {
    await recordPollSuccess();
    setHealthDeps({
      getAuditBufferSize: () => 85,
      loadCursor: () => Promise.resolve({}),
    });
    const report = await runHealthChecks();
    const audit = report.checks.find((c) => c.name === "audit_logger_healthy");
    expect(audit?.status).toBe("degraded");
  });

  it("process_alive is always healthy", async () => {
    const report = await runHealthChecks();
    const alive = report.checks.find((c) => c.name === "process_alive");
    expect(alive?.status).toBe("healthy");
  });

  it("returns degraded for audit and cursor when health deps not set", async () => {
    setHealthDeps(null);
    const report = await runHealthChecks();
    const audit = report.checks.find((c) => c.name === "audit_logger_healthy");
    const cursor = report.checks.find((c) => c.name === "cursor_state_loadable");
    expect(audit?.status).toBe("degraded");
    expect(audit?.message).toContain("not set");
    expect(cursor?.status).toBe("degraded");
    expect(cursor?.message).toContain("not set");
    setHealthDeps({
      getAuditBufferSize: () => 0,
      loadCursor: () => Promise.resolve({ since_id: null, last_fetch_at: "", fetched_count: 0, version: 1 }),
    });
  });
});
