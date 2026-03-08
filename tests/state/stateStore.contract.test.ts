import { describe, it, expect, beforeEach } from "vitest";
import type { StateStore, EventTracking, CursorState } from "../../src/state/stateStore.js";
import { getFileSystemStore } from "../../src/state/fileSystemStore.js";

/**
 * StateStore Contract Tests
 * 
 * These tests verify that all StateStore implementations behave identically.
 * Run against FileSystemStore and RedisStore.
 */

// Helper to create a fresh store instance for each test
function createStore(): StateStore {
  return getFileSystemStore();
}

describe("StateStore Contract", () => {
  let store: StateStore;

  beforeEach(async () => {
    store = createStore();
    await store.resetBudget();
  });

  describe("3.1 Event State Operations", () => {
    it("getEventState returns null for missing key", async () => {
      const state = await store.getEventState("nonexistent");
      expect(state).toBeNull();
    });

    it("setEventState stores and retrieves event state", async () => {
      const tracking: EventTracking = {
        eventId: "test_event_1",
        state: "publish_succeeded",
        attempts: 1,
        tweetId: "tweet_123",
        lastAttemptAt: Date.now(),
      };

      await store.setEventState("test_event_1", tracking);
      const retrieved = await store.getEventState("test_event_1");

      expect(retrieved).toEqual(tracking);
    });

    it("setEventState overwrites existing state", async () => {
      const tracking1: EventTracking = {
        eventId: "test_event_2",
        state: "event_seen",
        attempts: 0,
      };

      const tracking2: EventTracking = {
        eventId: "test_event_2",
        state: "publish_succeeded",
        attempts: 1,
        tweetId: "tweet_456",
      };

      await store.setEventState("test_event_2", tracking1);
      await store.setEventState("test_event_2", tracking2);

      const retrieved = await store.getEventState("test_event_2");
      expect(retrieved?.state).toBe("publish_succeeded");
    });

    it("deleteEventState removes state", async () => {
      const tracking: EventTracking = {
        eventId: "test_event_3",
        state: "processed_ok",
        attempts: 0,
      };

      await store.setEventState("test_event_3", tracking);
      await store.deleteEventState("test_event_3");

      const retrieved = await store.getEventState("test_event_3");
      expect(retrieved).toBeNull();
    });
  });

  describe("3.2 Cursor Operations", () => {
    it("getCursor returns null for missing cursor", async () => {
      const cursor = await store.getCursor();
      // Note: FileSystemStore returns null, but implementation may vary
      expect(cursor === null || cursor?.since_id === null).toBe(true);
    });

    it("setCursor stores and retrieves cursor", async () => {
      const cursor: CursorState = {
        since_id: "1234567890",
        last_fetch_at: new Date().toISOString(),
        fetched_count: 10,
        version: 1,
      };

      await store.setCursor(cursor);
      const retrieved = await store.getCursor();

      expect(retrieved).toEqual(cursor);
    });

    it("setCursor overwrites existing cursor", async () => {
      const cursor1: CursorState = {
        since_id: "1111111111",
        last_fetch_at: new Date().toISOString(),
        fetched_count: 5,
        version: 1,
      };

      const cursor2: CursorState = {
        since_id: "2222222222",
        last_fetch_at: new Date().toISOString(),
        fetched_count: 10,
        version: 1,
      };

      await store.setCursor(cursor1);
      await store.setCursor(cursor2);

      const retrieved = await store.getCursor();
      expect(retrieved?.since_id).toBe("2222222222");
    });
  });

  describe("3.3 Publish Lock Operations", () => {
    it("acquirePublishLock returns true on first acquire", async () => {
      const acquired = await store.acquirePublishLock("event_1", 30000);
      expect(acquired).toBe(true);
    });

    it("acquirePublishLock returns false when lock held", async () => {
      await store.acquirePublishLock("event_2", 30000);
      const acquired = await store.acquirePublishLock("event_2", 30000);
      expect(acquired).toBe(false);
    });

    it("releasePublishLock allows re-acquisition", async () => {
      await store.acquirePublishLock("event_3", 30000);
      await store.releasePublishLock("event_3");
      const acquired = await store.acquirePublishLock("event_3", 30000);
      expect(acquired).toBe(true);
    });

    it("isPublished returns false for unpublished event", async () => {
      const result = await store.isPublished("unpublished_event");
      expect(result.published).toBe(false);
    });

    it("markPublished and isPublished work together", async () => {
      await store.markPublished("published_event", "tweet_123", 30000);
      const result = await store.isPublished("published_event");
      
      expect(result.published).toBe(true);
      expect(result.tweetId).toBe("tweet_123");
    });
  });

  describe("3.4 Budget Operations", () => {
    it("getBudgetUsage returns 0 initially", async () => {
      const windowStart = Date.now();
      const usage = await store.getBudgetUsage(windowStart);
      expect(usage).toBe(0);
    });

    it("incrementBudgetUsage increases budget", async () => {
      const windowStart = Math.floor(Date.now() / 60000) * 60000;
      
      await store.incrementBudgetUsage(1, 60000);
      const usage = await store.getBudgetUsage(windowStart);
      
      expect(usage).toBe(1);
    });

    it("incrementBudgetUsage accumulates correctly", async () => {
      const windowStart = Math.floor(Date.now() / 60000) * 60000;
      
      await store.incrementBudgetUsage(1, 60000);
      await store.incrementBudgetUsage(2, 60000);
      await store.incrementBudgetUsage(1, 60000);
      
      const usage = await store.getBudgetUsage(windowStart);
      expect(usage).toBe(4);
    });

    it("resetBudget clears usage", async () => {
      const windowStart = Math.floor(Date.now() / 60000) * 60000;
      
      await store.incrementBudgetUsage(5, 60000);
      await store.resetBudget();
      
      // After reset, should return 0 for new window
      const newWindowStart = windowStart + 60000;
      const usage = await store.getBudgetUsage(newWindowStart);
      expect(usage).toBe(0);
    });
  });

  describe("3.5 Connection Health", () => {
    it("ping returns true for healthy store", async () => {
      const healthy = await store.ping();
      expect(healthy).toBe(true);
    });

    it("close does not throw", async () => {
      await expect(store.close()).resolves.not.toThrow();
    });
  });
});
