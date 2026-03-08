import { describe, it, expect, beforeEach } from "vitest";
import { join } from "node:path";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { getFileSystemStore } from "../../src/state/fileSystemStore.js";
import type { EventTracking, CursorState } from "../../src/state/stateStore.js";

/**
 * FileSystem store: persistence, missing files/dirs, corrupted data, close semantics.
 */

function uniqueDir(): string {
  return join(tmpdir(), `gorky-fs-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
}

describe("fileSystemStore", () => {
  describe("persistence and re-instantiation", () => {
    it("persists event state and survives re-instantiation", async () => {
      const dataDir = uniqueDir();
      const store1 = getFileSystemStore(dataDir);
      const tracking: EventTracking = {
        eventId: "ev_persist",
        state: "publish_succeeded",
        attempts: 1,
        tweetId: "tw_1",
        lastAttemptAt: Date.now(),
      };
      await store1.setEventState("ev_persist", tracking);
      const store2 = getFileSystemStore(dataDir);
      const retrieved = await store2.getEventState("ev_persist");
      expect(retrieved).toEqual(tracking);
    });

    it("persists cursor and survives re-instantiation", async () => {
      const dataDir = uniqueDir();
      const store1 = getFileSystemStore(dataDir);
      const cursor: CursorState = {
        since_id: "999",
        last_fetch_at: new Date().toISOString(),
        fetched_count: 5,
        version: 1,
      };
      await store1.setCursor(cursor);
      const store2 = getFileSystemStore(dataDir);
      const retrieved = await store2.getCursor();
      expect(retrieved).toEqual(cursor);
    });

    it("persists published state across instances", async () => {
      const dataDir = uniqueDir();
      const store1 = getFileSystemStore(dataDir);
      await store1.markPublished("ev_pub", "tweet_xyz", 60000);
      const store2 = getFileSystemStore(dataDir);
      const result = await store2.isPublished("ev_pub");
      expect(result.published).toBe(true);
      expect(result.tweetId).toBe("tweet_xyz");
    });
  });

  describe("missing files and dirs", () => {
    it("getEventState returns null for missing key", async () => {
      const dataDir = uniqueDir();
      const store = getFileSystemStore(dataDir);
      const state = await store.getEventState("nonexistent");
      expect(state).toBeNull();
    });

    it("getCursor returns null when no cursor file", async () => {
      const dataDir = uniqueDir();
      mkdirSync(dataDir, { recursive: true });
      const store = getFileSystemStore(dataDir);
      const cursor = await store.getCursor();
      expect(cursor).toBeNull();
    });

    it("creates data dir on first write and ping succeeds", async () => {
      const dataDir = uniqueDir();
      const store = getFileSystemStore(dataDir);
      await store.setEventState("ensure_dir", {
        eventId: "ensure_dir",
        state: "event_seen",
        attempts: 0,
      });
      expect(existsSync(dataDir)).toBe(true);
      const ok = await store.ping();
      expect(ok).toBe(true);
    });
  });

  describe("corrupted data handling", () => {
    it("handles corrupted event_state.json by returning null for keys", async () => {
      const dataDir = uniqueDir();
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(join(dataDir, "event_state.json"), "not valid json {", "utf-8");
      const store = getFileSystemStore(dataDir);
      const state = await store.getEventState("any");
      expect(state).toBeNull();
    });

    it("handles corrupted cursor file by returning null", async () => {
      const dataDir = uniqueDir();
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(join(dataDir, "cursor_state.json"), "{ broken }", "utf-8");
      const store = getFileSystemStore(dataDir);
      const cursor = await store.getCursor();
      expect(cursor).toBeNull();
    });
  });

  describe("close and cleanup", () => {
    it("close does not throw", async () => {
      const store = getFileSystemStore(uniqueDir());
      await expect(store.close()).resolves.not.toThrow();
    });
  });
});
