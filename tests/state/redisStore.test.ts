import { describe, it, expect } from "vitest";
import { getRedisStore, maskUrl } from "../../src/state/redisStore.js";

/**
 * Redis store: skip when KV_URL or REDIS_URL not set.
 */

const hasRedis = !!(process.env.KV_URL ?? process.env.REDIS_URL);

describe.skipIf(!hasRedis)("redisStore", () => {
  it("runs redis specific tests if hasRedis", async () => {
    const store = getRedisStore();
    expect(store).toBeDefined();
    await store.close();
  });

  describe("maskUrl", () => {
    it("redacts credentials", () => {
      const url = "redis://user:password@host:6379/0";
      expect(maskUrl(url)).toBe("redis://***:***@host:6379/0");
    });

    it("handles invalid urls", () => {
      expect(maskUrl("not-a-url")).toBe("[invalid-url]");
    });
  });
});
