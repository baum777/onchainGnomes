import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getStateStore,
  resetStoreCache,
  getStoreType,
} from "../../src/state/storeFactory.js";
import { RedisStateStore } from "../../src/state/redisStore.js";
import { FileSystemStateStore } from "../../src/state/fileSystemStore.js";

describe("storeFactory", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetStoreCache();
  });

  afterEach(() => {
    resetStoreCache();
    // Restore original env
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
  });

  describe("getStateStore", () => {
    it("returns FileSystemStateStore when USE_REDIS is false", () => {
      process.env.USE_REDIS = "false";
      delete process.env.KV_URL;

      const store = getStateStore();
      expect(store).toBeInstanceOf(FileSystemStateStore);
    });

    it("returns FileSystemStateStore when USE_REDIS is undefined", () => {
      delete process.env.USE_REDIS;
      delete process.env.KV_URL;

      const store = getStateStore();
      expect(store).toBeInstanceOf(FileSystemStateStore);
    });

    it("throws when USE_REDIS=true but KV_URL is missing", () => {
      process.env.USE_REDIS = "true";
      delete process.env.KV_URL;
      delete process.env.REDIS_URL;

      expect(() => getStateStore()).toThrow(
        "USE_REDIS=true oder Production-Umgebung erkannt, aber KV_URL fehlt."
      );
    });

    it("throws when KV_URL does not use redis:// protocol", () => {
      process.env.USE_REDIS = "true";
      process.env.KV_URL = "https://upstash.example.com";

      expect(() => getStateStore()).toThrow(
        "KV_URL muss redis:// protocol nutzen."
      );
    });

    it("trims whitespace from KV_URL", () => {
      process.env.USE_REDIS = "true";
      process.env.KV_URL = "  redis://localhost:6379  ";

      // Should not throw
      const store = getStateStore();
      expect(store).toBeInstanceOf(RedisStateStore);
    });

    it("returns cached store on subsequent calls", () => {
      process.env.USE_REDIS = "false";
      delete process.env.KV_URL;

      const store1 = getStateStore();
      const store2 = getStateStore();
      expect(store1).toBe(store2);
    });
  });

  describe("getStoreType", () => {
    it('returns "unknown" when no store is cached', () => {
      resetStoreCache();
      expect(getStoreType()).toBe("unknown");
    });

    it('returns "filesystem" when FileSystemStateStore is cached', () => {
      process.env.USE_REDIS = "false";
      delete process.env.KV_URL;

      getStateStore();
      expect(getStoreType()).toBe("filesystem");
    });

    it('returns "redis" when RedisStateStore is cached', () => {
      process.env.USE_REDIS = "true";
      process.env.KV_URL = "redis://localhost:6379";

      getStateStore();
      expect(getStoreType()).toBe("redis");
    });
  });

  describe("resetStoreCache", () => {
    it("clears the cached store", () => {
      process.env.USE_REDIS = "false";
      delete process.env.KV_URL;

      const store1 = getStateStore();
      resetStoreCache();
      const store2 = getStateStore();

      expect(store1).not.toBe(store2);
    });

    it("causes getStoreType to return unknown", () => {
      process.env.USE_REDIS = "false";
      delete process.env.KV_URL;

      getStateStore();
      resetStoreCache();
      expect(getStoreType()).toBe("unknown");
    });
  });
});
