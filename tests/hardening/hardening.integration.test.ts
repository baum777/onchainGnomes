/**
 * Hardening integration tests — operatively relevant coverage for StateStore migration,
 * restart-safe dedupe, publish idempotency, heartbeat/health, rate limiter, runtime config.
 *
 * Focus: behavior and runtime semantics, not implementation details.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  migrateLegacyState,
  type LegacyProcessedState,
} from "../../src/worker/migrateLegacyState.js";
import { getStateStore, resetStoreCache } from "../../src/state/storeFactory.js";
import {
  isProcessed,
  recordMentionSkipped,
  recordEventSeen,
  recordEventProcessed,
  publishWithRetry,
  isPublished,
  resetEventStates,
} from "../../src/state/eventStateStore.js";
import {
  recordPollSuccess,
  resetPollSuccessTimestamp,
  runHealthChecks,
  setHealthDeps,
} from "../../src/observability/health.js";
import { rateLimitTake } from "../../src/ops/rateLimiter.js";
import { getRateLimitBackend } from "../../src/ops/rateLimitBackend.js";
import { cacheClear } from "../../src/ops/memoryCache.js";
import { getConfig, resetConfigCache } from "../../src/config/runtimeConfig.js";

describe("hardening integration", () => {
  let tempDir: string;

  beforeEach(() => {
    process.env.USE_REDIS = "false";
    tempDir = mkdtempSync(path.join(tmpdir(), "hardening-"));
    process.env.DATA_DIR = tempDir;
    resetStoreCache();
  });

  afterEach(async () => {
    await resetEventStates();
    await resetPollSuccessTimestamp();
    resetConfigCache();
    if (tempDir && fs.existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    delete process.env.DATA_DIR;
    delete process.env.RATE_LIMIT_BACKEND;
  });

  describe("1. Migration from legacy processed_mentions.json", () => {
    it("reads legacy file, migrates entries to store, renames file", async () => {
      const legacyFile = path.join(tempDir, "processed_mentions.json");
      const state: LegacyProcessedState = {
        last_since_id: "999888777",
        processed: ["m1", "m2", "m3"],
      };
      fs.writeFileSync(legacyFile, JSON.stringify(state, null, 2), "utf-8");

      const store = getStateStore();
      const result = await migrateLegacyState(legacyFile, store);

      expect(result.migratedCount).toBe(3);
      expect(result.cursorSet).toBe(true);
      expect(result.fileRenamed).toBe(true);
      expect(fs.existsSync(legacyFile)).toBe(false);
      expect(fs.existsSync(legacyFile + ".migrated")).toBe(true);

      const cursor = await store.getCursor();
      expect(cursor?.since_id).toBe("999888777");
      expect(await store.getEventState("m1")).toMatchObject({ state: "processed_ok", eventId: "m1" });
      expect(await store.getEventState("m2")).toMatchObject({ state: "processed_ok", eventId: "m2" });
    });

    it("is idempotent when file does not exist", async () => {
      const store = getStateStore();
      const result = await migrateLegacyState(path.join(tempDir, "nonexistent.json"), store);

      expect(result.migratedCount).toBe(0);
      expect(result.cursorSet).toBe(false);
      expect(result.fileRenamed).toBe(false);
    });

    it("does not double-migrate: after migration file is gone", async () => {
      const legacyFile = path.join(tempDir, "processed_mentions.json");
      fs.writeFileSync(
        legacyFile,
        JSON.stringify({ processed: ["d1"], last_since_id: "111" }, null, 2),
        "utf-8"
      );

      const store = getStateStore();
      await migrateLegacyState(legacyFile, store);
      const secondResult = await migrateLegacyState(legacyFile, store);

      expect(secondResult.migratedCount).toBe(0);
      expect(fs.existsSync(legacyFile)).toBe(false);
    });
  });

  describe("2. Restart-safe processed dedupe", () => {
    it("recordMentionSkipped makes isProcessed true and persists across cache reset", async () => {
      const eventId = `dedupe_${Date.now()}`;
      await recordMentionSkipped(eventId);

      expect(await isProcessed(eventId)).toBe(true);
      await resetEventStates();
      expect(await isProcessed(eventId)).toBe(true);
    });

    it("recordEventProcessed and isPublished both make isProcessed true", async () => {
      const id1 = `proc_${Date.now()}`;
      const id2 = `pub_${Date.now()}_2`;
      await recordEventProcessed(id1);
      await recordEventSeen(id2);
      await publishWithRetry(id2, async () => ({ tweetId: "t123" }));

      expect(await isProcessed(id1)).toBe(true);
      expect(await isProcessed(id2)).toBe(true);
    });
  });

  describe("3. Publish idempotency", () => {
    it("already published event is not republished", async () => {
      const eventId = `idem_${Date.now()}`;
      const publishFn = vi.fn().mockResolvedValue({ tweetId: "t456" });

      const first = await publishWithRetry(eventId, publishFn);
      expect(first.success).toBe(true);
      const second = await publishWithRetry(eventId, publishFn);

      expect(second.success).toBe(true);
      expect(second.tweetId).toBe("t456");
      expect(publishFn).toHaveBeenCalledTimes(1);
    });

    it("restart-safe: after cache clear, isPublished still prevents republish", async () => {
      const eventId = `idem_restart_${Date.now()}`;
      const publishFn = vi.fn().mockResolvedValue({ tweetId: "t789" });

      await publishWithRetry(eventId, publishFn);
      await resetEventStates();

      const again = await publishWithRetry(eventId, publishFn);
      expect(again.success).toBe(true);
      expect(again.tweetId).toBe("t789");
      expect(publishFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("4. Worker heartbeat / Health / Readiness", () => {
    beforeEach(() => {
      setHealthDeps({
        getAuditBufferSize: () => 0,
        loadCursor: () => getStateStore().getCursor(),
      });
    });

    it("recordPollSuccess writes heartbeat; runHealthChecks returns healthy", async () => {
      await recordPollSuccess();
      const report = await runHealthChecks();
      expect(report.status).toBe("healthy");
      const pollCheck = report.checks.find((c) => c.name === "recent_poll_success");
      expect(pollCheck?.status).toBe("healthy");
    });

    it("missing heartbeat yields degraded recent_poll_success", async () => {
      await resetPollSuccessTimestamp();
      const report = await runHealthChecks();
      const pollCheck = report.checks.find((c) => c.name === "recent_poll_success");
      expect(pollCheck?.status).toBe("degraded");
      expect(pollCheck?.message).toBeDefined();
    });

    it("stale heartbeat yields unhealthy", async () => {
      const store = getStateStore();
      const staleTs = Date.now() - 10 * 60 * 1000;
      await store.set("worker:last_poll_success", String(staleTs), 600);

      const report = await runHealthChecks();
      const pollCheck = report.checks.find((c) => c.name === "recent_poll_success");
      expect(pollCheck?.status).toBe("unhealthy");
    });
  });

  describe("5. RateLimiter backend semantics", () => {
    it("memory backend enforces limits within process", async () => {
      process.env.RATE_LIMIT_BACKEND = "memory";
      await cacheClear();

      const id = `rl_mem_${Date.now()}`;
      const a = await rateLimitTake({ scope: "global", id, capacity: 2, refillPerMinute: 2 });
      const b = await rateLimitTake({ scope: "global", id, capacity: 2, refillPerMinute: 2 });
      const c = await rateLimitTake({ scope: "global", id, capacity: 2, refillPerMinute: 2 });

      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      expect(c.ok).toBe(false);
    });

    it("store backend uses StateStore and enforces limits", async () => {
      process.env.RATE_LIMIT_BACKEND = "store";

      const id = `rl_store_${Date.now()}`;
      const a = await rateLimitTake({ scope: "global", id, capacity: 2, refillPerMinute: 2 });
      const b = await rateLimitTake({ scope: "global", id, capacity: 2, refillPerMinute: 2 });
      const c = await rateLimitTake({ scope: "global", id, capacity: 2, refillPerMinute: 2 });

      expect(a.ok).toBe(true);
      expect(b.ok).toBe(true);
      expect(c.ok).toBe(false);
    });

    it("getRateLimitBackend returns backend with get/set", () => {
      const backend = getRateLimitBackend();
      expect(backend).toBeDefined();
      expect(typeof backend.get).toBe("function");
      expect(typeof backend.set).toBe("function");
    });
  });

  describe("6. RuntimeConfig smoke", () => {
    it("getConfig returns merged structure with core keys when env validated", () => {
      process.env.X_CLIENT_ID = "test_client_id";
      process.env.X_CLIENT_SECRET = "test_client_secret";
      process.env.X_REFRESH_TOKEN = "test_refresh_token";
      process.env.X_ACCESS_TOKEN = "test_access_token";

      const config = getConfig();
      expect(config.X_CLIENT_ID).toBe("test_client_id");
      expect(config.USE_REDIS).toBeDefined();
      expect(typeof config.USE_REDIS).toBe("boolean");
      expect(config.LAUNCH_MODE).toBeDefined();
      expect(config.POLL_INTERVAL_MS).toBeDefined();
      expect(typeof config.POLL_INTERVAL_MS).toBe("number");
    });
  });
});
