/**
 * Multi-worker integration test — no duplicate publish under concurrent workers.
 *
 * Verifies: 2+ concurrent publish attempts for the same eventId result in exactly one API call.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { publishWithRetry, recordEventSeen } from "../../src/state/eventStateStore.js";
import { getStateStore, resetStoreCache } from "../../src/state/storeFactory.js";
import { resetEventStates } from "../../src/state/eventStateStore.js";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

describe("production-proof: multi-worker no duplicate publish", () => {
  let tempDir: string;

  beforeEach(() => {
    process.env.USE_REDIS = "false";
    tempDir = mkdtempSync(path.join(tmpdir(), "prod-proof-"));
    process.env.DATA_DIR = tempDir;
    resetStoreCache();
  });

  afterEach(async () => {
    await resetEventStates();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    delete process.env.DATA_DIR;
  });

  it("concurrent publishWithRetry for same eventId results in exactly one publish call", async () => {
    const eventId = `mw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const publishFn = vi.fn().mockResolvedValue({ tweetId: "t_concurrent_1" });

    await recordEventSeen(eventId);

    // Simulate 3 workers attempting to publish the same mention concurrently
    const results = await Promise.all([
      publishWithRetry(eventId, publishFn),
      publishWithRetry(eventId, publishFn),
      publishWithRetry(eventId, publishFn),
    ]);

    const successCount = results.filter((r) => r.success).length;
    expect(successCount).toBeGreaterThanOrEqual(1);
    expect(successCount).toBeLessThanOrEqual(3); // All may report success (idempotent return)
    expect(publishFn).toHaveBeenCalledTimes(1); // Exactly one actual API call
    expect(results.every((r) => r.tweetId === "t_concurrent_1" || r.tweetId === undefined)).toBe(true);
  });

  it("sequential workers: first publishes, second sees published and skips", async () => {
    const eventId = `mw_seq_${Date.now()}`;
    const publishFn = vi.fn().mockResolvedValue({ tweetId: "t_seq_1" });

    const first = await publishWithRetry(eventId, publishFn);
    expect(first.success).toBe(true);
    expect(publishFn).toHaveBeenCalledTimes(1);

    const second = await publishWithRetry(eventId, publishFn);
    expect(second.success).toBe(true);
    expect(second.tweetId).toBe("t_seq_1");
    expect(publishFn).toHaveBeenCalledTimes(1);
  });
});
