import { describe, it, expect } from "vitest";
import { createMemoryCache } from "../../src/context/cache.js";

describe("cache", () => {
  it("returns null for missing key", () => {
    const cache = createMemoryCache();
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("returns stored value within TTL", () => {
    const cache = createMemoryCache();
    cache.set("key1", "value1", 60_000);
    expect(cache.get("key1")).toBe("value1");
    expect(cache.get<string>("key1")).toBe("value1");
  });

  it("returns null after TTL expires", async () => {
    const cache = createMemoryCache();
    cache.set("key1", "value1", 50); // 50ms
    expect(cache.get("key1")).toBe("value1");
    await new Promise((r) => setTimeout(r, 60));
    expect(cache.get("key1")).toBeNull();
  });

  it("stores objects", () => {
    const cache = createMemoryCache();
    const obj = { foo: "bar", count: 42 };
    cache.set("obj", obj, 60_000);
    expect(cache.get<typeof obj>("obj")).toEqual(obj);
  });

  it("overwrites existing key", () => {
    const cache = createMemoryCache();
    cache.set("k", "v1", 60_000);
    cache.set("k", "v2", 60_000);
    expect(cache.get("k")).toBe("v2");
  });
});
