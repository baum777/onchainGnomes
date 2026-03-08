import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadCursorState,
  saveCursorState,
  updateCursor,
  isValidCursor,
  CursorManager,
  getCachedCursor,
  forcePersistCursor,
} from "../../src/state/cursorStateStore.js";
import { getStateStore, resetStoreCache } from "../../src/state/storeFactory.js";
import type { CursorState } from "../../src/state/stateStore.js";

/**
 * Cursor state store: persistence, throttled writes, out-of-order rejection,
 * restart reads last persisted cursor.
 */

beforeEach(() => {
  delete process.env.USE_REDIS;
  resetStoreCache();
});

describe("cursorStateStore", () => {
  describe("set and get cursor", () => {
    it("saveCursorState and loadCursorState round-trip", async () => {
      const state: CursorState = {
        since_id: "1000",
        last_fetch_at: new Date().toISOString(),
        fetched_count: 5,
        version: 1,
      };
      await saveCursorState(state);
      const loaded = await loadCursorState();
      expect(loaded.since_id).toBe("1000");
      expect(loaded.fetched_count).toBe(5);
    });

    it("loadCursorState returns valid state shape with version", async () => {
      const loaded = await loadCursorState();
      expect(loaded).toHaveProperty("version", 1);
      expect(loaded).toHaveProperty("since_id");
      expect(loaded).toHaveProperty("last_fetch_at");
      expect(loaded).toHaveProperty("fetched_count");
    });
  });

  describe("throttled persistence", () => {
    it("updateCursor persists; after throttle interval next update persists", async () => {
      vi.useFakeTimers();
      const store = getStateStore();
      await saveCursorState({
        since_id: null,
        last_fetch_at: new Date(0).toISOString(),
        fetched_count: 0,
        version: 1,
      });
      vi.advanceTimersByTime(61_000);

      await updateCursor("100", 1);
      let cursor = await store.getCursor();
      expect(cursor?.since_id).toBe("100");

      vi.advanceTimersByTime(61_000);
      await updateCursor("200", 2);
      cursor = await store.getCursor();
      expect(cursor?.since_id).toBe("200");

      vi.useRealTimers();
    });
  });

  describe("out-of-order cursor rejected", () => {
    it("isValidCursor rejects older cursor", () => {
      expect(isValidCursor("100", "200")).toBe(false);
      expect(isValidCursor("200", "100")).toBe(true);
      expect(isValidCursor("100", null)).toBe(true);
    });

    it("CursorManager onFetchSuccess ignores out-of-order cursor", async () => {
      const state = await loadCursorState();
      state.since_id = "200";
      const manager = new CursorManager(state);
      await manager.onFetchSuccess("100", 1);
      expect(manager.getStats().since_id).toBe("200");
      await manager.onFetchSuccess("300", 2);
      expect(manager.getStats().since_id).toBe("300");
    });
  });

  describe("new instance sees latest valid cursor", () => {
    it("after saveCursorState, loadCursorState returns same state", async () => {
      const state: CursorState = {
        since_id: "9999",
        last_fetch_at: new Date().toISOString(),
        fetched_count: 42,
        version: 1,
      };
      await saveCursorState(state);
      const loaded = await loadCursorState();
      expect(loaded.since_id).toBe("9999");
      expect(loaded.fetched_count).toBe(42);
    });

    it("getCachedCursor reflects last loaded/saved cursor", async () => {
      await saveCursorState({
        since_id: "cache_1",
        last_fetch_at: new Date().toISOString(),
        fetched_count: 1,
        version: 1,
      });
      expect(getCachedCursor()).toBe("cache_1");
    });
  });

  describe("forcePersistCursor", () => {
    it("forcePersistCursor does not throw", async () => {
      await saveCursorState({
        since_id: "force_1",
        last_fetch_at: new Date().toISOString(),
        fetched_count: 1,
        version: 1,
      });
      await expect(forcePersistCursor()).resolves.not.toThrow();
    });
  });
});
