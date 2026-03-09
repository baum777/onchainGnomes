import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getRedisStore } from "../../src/state/redisStore.js";
import type { EventTracking, CursorState } from "../../src/state/stateStore.js";

/**
 * Redis store: skip when KV_URL or REDIS_URL not set; TTL, ping/close, persistence semantics.
 */

const hasRedis = !!(process.env.KV_URL ?? process.env.REDIS_URL);

describe.skipIf(!hasRedis)("redisStore", () => {
  const store = getRedisStore();

  beforeEach(async () => {
    await store.resetBudget();
  });

  afterEach(async () => {
    await store.close();
  });

  describe("persistence semantics", () => {
    it("setEventState and getEventState round-trip", async () => {
      const tracking: EventTracking = {
        eventId: "redis_ev_1",
        state: "publish_succeeded",
        attempts: 1,
        tweetId: "tweet_r1",
        lastAttemptAt: Date.now(),
      };
      await store.setEventState("redis_ev_1", tracking);
      const retrieved = await store.getEventState("redis_ev_1");
      expect(retrieved).toEqual(tracking);
    });

    it("setCursor and getCursor round-trip", async () => {
      const cursor: CursorState = {
        since_id: "12345",
        last_fetch_at: new Date().toISOString(),
        fetched_count: 10,
        version: 1,
      };
      await store.setCursor(cursor);
      const retrieved = await store.getCursor();
      expect(retrieved).toEqual(cursor);
    });

    it("markPublished and isPublished", async () => {
      await store.markPublished("redis_pub_1", "tweet_p1", 60000);
      const r = await store.isPublished("redis_pub_1");
      expect(r.published).toBe(true);
      expect(r.tweetId).toBe("tweet_p1");
    });
  });

  describe("TTL behavior", () => {
    it("publish lock expires after TTL and can be re-acquired", async () => {
      vi.useFakeTimers();
      try {
        const ttlMs = 200;
        const ok1 = await store.acquirePublishLock("redis_ttl_lock", ttlMs);
        expect(ok1).toBe(true);
        const ok2 = await store.acquirePublishLock("redis_ttl_lock", ttlMs);
        expect(ok2).toBe(false);
        vi.advanceTimersByTime(ttlMs + 50);
        const ok3 = await store.acquirePublishLock("redis_ttl_lock", ttlMs);
        expect(ok3).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("ping and close", () => {
    it("ping returns true when connected", async () => {
      const ok = await store.ping();
      expect(ok).toBe(true);
    });

    it("close does not throw", async () => {
      await expect(store.close()).resolves.not.toThrow();
    });
  });
});
