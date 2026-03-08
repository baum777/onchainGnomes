import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { StateStore, EventTracking, CursorState } from "../../src/state/stateStore.js";
import { getFileSystemStore } from "../../src/state/fileSystemStore.js";
import { getRedisStore } from "../../src/state/redisStore.js";

/**
 * StateStore Contract Tests
 *
 * Run the same contract against FileSystemStore and RedisStore.
 * TTL lock expiry and error semantics are covered where practical.
 * Redis block runs only when REDIS_URL is set.
 * FileSystem uses an isolated temp dir per run so "missing cursor" is deterministic.
 */

function uniqueDataDir(): string {
  return join(tmpdir(), `contract-fs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
}

function createFileSystemStore(): StateStore {
  return getFileSystemStore(uniqueDataDir());
}

// FileSystem: always run. Redis: only when REDIS_URL is set (skip entire block otherwise).
describe("StateStore Contract (FileSystem)", () => {
  let store: StateStore;

  beforeEach(async () => {
    store = createFileSystemStore();
    await store.resetBudget();
  });

  const withStore = (fn: (s: StateStore) => Promise<void>) => async () => {
    await fn(store);
  };

    describe("3.1 Event State Operations", () => {
      it("getEventState returns null for missing key", withStore(async (s) => {
        const state = await s.getEventState("nonexistent");
        expect(state).toBeNull();
      }));

      it("setEventState stores and retrieves event state", withStore(async (s) => {
        const tracking: EventTracking = {
          eventId: "test_event_1",
          state: "publish_succeeded",
          attempts: 1,
          tweetId: "tweet_123",
          lastAttemptAt: Date.now(),
        };
        await s.setEventState("test_event_1", tracking);
        const retrieved = await s.getEventState("test_event_1");
        expect(retrieved).toEqual(tracking);
      }));

      it("setEventState overwrites existing state", withStore(async (s) => {
        await s.setEventState("test_event_2", {
          eventId: "test_event_2",
          state: "event_seen",
          attempts: 0,
        });
        await s.setEventState("test_event_2", {
          eventId: "test_event_2",
          state: "publish_succeeded",
          attempts: 1,
          tweetId: "tweet_456",
        });
        const retrieved = await s.getEventState("test_event_2");
        expect(retrieved?.state).toBe("publish_succeeded");
      }));

      it("deleteEventState removes state", withStore(async (s) => {
        await s.setEventState("test_event_3", {
          eventId: "test_event_3",
          state: "processed_ok",
          attempts: 0,
        });
        await s.deleteEventState("test_event_3");
        const retrieved = await s.getEventState("test_event_3");
        expect(retrieved).toBeNull();
      }));
    });

    describe("3.2 Cursor Operations", () => {
      it("getCursor returns null or empty for missing cursor", withStore(async (s) => {
        const cursor = await s.getCursor();
        expect(cursor === null || cursor?.since_id === null).toBe(true);
      }));

      it("setCursor stores and retrieves cursor", withStore(async (s) => {
        const cursor: CursorState = {
          since_id: "1234567890",
          last_fetch_at: new Date().toISOString(),
          fetched_count: 10,
          version: 1,
        };
        await s.setCursor(cursor);
        const retrieved = await s.getCursor();
        expect(retrieved).toEqual(cursor);
      }));

      it("setCursor overwrites existing cursor", withStore(async (s) => {
        await s.setCursor({
          since_id: "1111111111",
          last_fetch_at: new Date().toISOString(),
          fetched_count: 5,
          version: 1,
        });
        await s.setCursor({
          since_id: "2222222222",
          last_fetch_at: new Date().toISOString(),
          fetched_count: 10,
          version: 1,
        });
        const retrieved = await s.getCursor();
        expect(retrieved?.since_id).toBe("2222222222");
      }));
    });

    describe("3.3 Publish Lock Operations", () => {
      it("acquirePublishLock returns true on first acquire", withStore(async (s) => {
        const acquired = await s.acquirePublishLock("event_1", 30000);
        expect(acquired).toBe(true);
      }));

      it("acquirePublishLock returns false when lock held", withStore(async (s) => {
        await s.acquirePublishLock("event_2", 30000);
        const acquired = await s.acquirePublishLock("event_2", 30000);
        expect(acquired).toBe(false);
      }));

      it("releasePublishLock allows re-acquisition", withStore(async (s) => {
        await s.acquirePublishLock("event_3", 30000);
        await s.releasePublishLock("event_3");
        const acquired = await s.acquirePublishLock("event_3", 30000);
        expect(acquired).toBe(true);
      }));

      it("isPublished returns false for unpublished event", withStore(async (s) => {
        const result = await s.isPublished("unpublished_event");
        expect(result.published).toBe(false);
      }));

      it("markPublished and isPublished work together", withStore(async (s) => {
        await s.markPublished("published_event", "tweet_123", 30000);
        const result = await s.isPublished("published_event");
        expect(result.published).toBe(true);
        expect(result.tweetId).toBe("tweet_123");
      }));

      it("lock expires after TTL and can be re-acquired", withStore(async (s) => {
        vi.useFakeTimers();
        try {
          const ttlMs = 100;
          const acquired1 = await s.acquirePublishLock("event_ttl", ttlMs);
          expect(acquired1).toBe(true);
          const acquired2 = await s.acquirePublishLock("event_ttl", ttlMs);
          expect(acquired2).toBe(false);
          vi.advanceTimersByTime(ttlMs + 1);
          const acquired3 = await s.acquirePublishLock("event_ttl", ttlMs);
          expect(acquired3).toBe(true);
        } finally {
          vi.useRealTimers();
        }
      }));
    });

    describe("3.4 Budget Operations", () => {
      it("getBudgetUsage returns 0 initially", withStore(async (s) => {
        const windowStart = Date.now();
        const usage = await s.getBudgetUsage(windowStart);
        expect(usage).toBe(0);
      }));

      it("incrementBudgetUsage increases budget", withStore(async (s) => {
        const windowStart = Math.floor(Date.now() / 60000) * 60000;
        await s.incrementBudgetUsage(1, 60000);
        const usage = await s.getBudgetUsage(windowStart);
        expect(usage).toBe(1);
      }));

      it("incrementBudgetUsage accumulates correctly", withStore(async (s) => {
        const windowStart = Math.floor(Date.now() / 60000) * 60000;
        await s.incrementBudgetUsage(1, 60000);
        await s.incrementBudgetUsage(2, 60000);
        await s.incrementBudgetUsage(1, 60000);
        const usage = await s.getBudgetUsage(windowStart);
        expect(usage).toBe(4);
      }));

      it("resetBudget clears usage", withStore(async (s) => {
        const windowStart = Math.floor(Date.now() / 60000) * 60000;
        await s.incrementBudgetUsage(5, 60000);
        await s.resetBudget();
        const newWindowStart = windowStart + 60000;
        const usage = await s.getBudgetUsage(newWindowStart);
        expect(usage).toBe(0);
      }));
    });

    describe("3.5 Connection Health", () => {
      it("ping returns true for healthy store", withStore(async (s) => {
        const healthy = await s.ping();
        expect(healthy).toBe(true);
      }));

      it("close does not throw", withStore(async (s) => {
        await expect(s.close()).resolves.not.toThrow();
      }));
    });

  describe("3.6 Error semantics", () => {
    it("getEventState for missing key returns null not throw", withStore(async (s) => {
      await expect(s.getEventState("missing")).resolves.toBeNull();
    }));

    it("isPublished on store returns consistent shape", withStore(async (s) => {
      const r = await s.isPublished("any");
      expect(r).toHaveProperty("published");
      expect(typeof r.published).toBe("boolean");
    }));
  });
});

// Redis: same contract when REDIS_URL is set (skip entire block otherwise)
describe.skipIf(!process.env.REDIS_URL)("StateStore Contract (Redis)", () => {
  let store: StateStore;

  beforeEach(async () => {
    store = getRedisStore();
    await store.resetBudget();
  });

  afterEach(async () => {
    await store.close();
  });

  const withStore = (fn: (s: StateStore) => Promise<void>) => async () => {
    await fn(store);
  };

  describe("3.1 Event State Operations", () => {
    it("getEventState returns null for missing key", withStore(async (s) => {
      expect(await s.getEventState("nonexistent")).toBeNull();
    }));
    it("setEventState stores and retrieves event state", withStore(async (s) => {
      const tracking: EventTracking = {
        eventId: "test_event_1",
        state: "publish_succeeded",
        attempts: 1,
        tweetId: "tweet_123",
        lastAttemptAt: Date.now(),
      };
      await s.setEventState("test_event_1", tracking);
      expect(await s.getEventState("test_event_1")).toEqual(tracking);
    }));
    it("deleteEventState removes state", withStore(async (s) => {
      await s.setEventState("test_event_3", { eventId: "test_event_3", state: "processed_ok", attempts: 0 });
      await s.deleteEventState("test_event_3");
      expect(await s.getEventState("test_event_3")).toBeNull();
    }));
  });

  describe("3.2 Cursor Operations", () => {
    it("setCursor stores and retrieves cursor", withStore(async (s) => {
      const cursor: CursorState = {
        since_id: "1234567890",
        last_fetch_at: new Date().toISOString(),
        fetched_count: 10,
        version: 1,
      };
      await s.setCursor(cursor);
      expect(await s.getCursor()).toEqual(cursor);
    }));
  });

  describe("3.3 Publish Lock", () => {
    it("acquire returns true then false when held", withStore(async (s) => {
      expect(await s.acquirePublishLock("re_1", 30000)).toBe(true);
      expect(await s.acquirePublishLock("re_1", 30000)).toBe(false);
    }));
    it("lock expires after TTL", withStore(async (s) => {
      vi.useFakeTimers();
      try {
        await s.acquirePublishLock("re_ttl", 100);
        vi.advanceTimersByTime(101);
        expect(await s.acquirePublishLock("re_ttl", 100)).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    }));
  });

  describe("3.4 Budget", () => {
    it("incrementBudgetUsage and getBudgetUsage", withStore(async (s) => {
      const windowStart = Math.floor(Date.now() / 60000) * 60000;
      await s.incrementBudgetUsage(2, 60000);
      expect(await s.getBudgetUsage(windowStart)).toBe(2);
    }));
  });

  describe("3.5 Health", () => {
    it("ping returns true", withStore(async (s) => {
      expect(await s.ping()).toBe(true);
    }));
  });
});
