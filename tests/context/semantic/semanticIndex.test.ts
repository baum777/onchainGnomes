import { describe, it, expect, beforeEach } from "vitest";
import { InMemorySemanticIndex } from "../../../src/context/semantic/semanticIndex.js";

describe("InMemorySemanticIndex", () => {
  let index: InMemorySemanticIndex;

  beforeEach(() => {
    index = new InMemorySemanticIndex({ maxDocs: 100, ttlDays: 1 });
  });

  it("upserts and queries documents", async () => {
    const docs = [
      { id: "1", vec: [1, 0, 0], text: "crypto trading" },
      { id: "2", vec: [0.9, 0.1, 0], text: "bitcoin charts" },
      { id: "3", vec: [0, 1, 0], text: "unrelated topic" },
    ];

    for (const d of docs) {
      await index.upsert(d.id, d.vec, { text: d.text });
    }

    const results = await index.query([1, 0, 0], 2);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.id).toBe("1");
    expect(results[0]!.sim).toBeGreaterThan(0.9);
  });

  it("respects max docs limit with FIFO eviction", async () => {
    const smallIndex = new InMemorySemanticIndex({ maxDocs: 2, ttlDays: 1 });

    await smallIndex.upsert("1", [1, 0], { text: "first" });
    await smallIndex.upsert("2", [0, 1], { text: "second" });
    await smallIndex.upsert("3", [0.5, 0.5], { text: "third" });

    // Size should be 2 after FIFO eviction
    expect(smallIndex.size()).toBe(2);

    // "1" should be evicted, not returned in query
    const results = await smallIndex.query([1, 0], 10);
    const ids = results.map((r) => r.id);
    expect(ids).not.toContain("1"); // First evicted
    // We only verify that "1" is not present, not specific remaining ids
    // because query might filter by similarity threshold
  });

  it("handles empty queries gracefully", async () => {
    const results = await index.query([1, 0, 0], 5);
    expect(results).toEqual([]);
  });

  it("updates existing documents", async () => {
    await index.upsert("1", [1, 0, 0], { text: "original" });
    await index.upsert("1", [0, 1, 0], { text: "updated" });

    const results = await index.query([0, 1, 0], 1);
    expect(results.length).toBe(1);
    expect(results[0]!.id).toBe("1");
    expect(results[0]!.sim).toBeCloseTo(1, 5);
  });

  it("respects topK limit", async () => {
    await index.upsert("1", [1, 0, 0], { text: "first" });
    await index.upsert("2", [0.9, 0.1, 0], { text: "second" });
    await index.upsert("3", [0.8, 0.2, 0], { text: "third" });

    const results = await index.query([1, 0, 0], 2);
    expect(results).toHaveLength(2);
  });

  it("respects similarity threshold", async () => {
    await index.upsert("1", [1, 0, 0], { text: "similar" });
    await index.upsert("2", [0, 1, 0], { text: "different" });

    const results = await index.query([1, 0, 0], 10, 0.9);
    expect(results.every((r) => r.sim >= 0.9)).toBe(true);
  });

  it("returns results sorted by similarity", async () => {
    // Use vectors pointing in different directions
    // Query is [1, 0.1, 0] - mostly x with slight y component
    await index.upsert("1", [0.3, 1, 0], { text: "low" }); // mostly y direction
    await index.upsert("2", [1, 0.1, 0], { text: "high" }); // close to query
    await index.upsert("3", [0.6, 0.6, 0], { text: "medium" }); // 45 degrees

    const results = await index.query([1, 0.1, 0], 3);
    // Verify descending order by similarity
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1]!.sim).toBeGreaterThanOrEqual(results[i]!.sim);
    }
    // Verify top result is most similar to query [1, 0.1, 0]
    expect(results[0]!.id).toBe("2"); // Closest to query direction
  });

  it("includes text in results", async () => {
    await index.upsert("1", [1, 0, 0], { text: "crypto trading" });

    const results = await index.query([1, 0, 0], 1);
    expect(results[0]!.text).toBe("crypto trading");
  });

  it("clears all documents", async () => {
    await index.upsert("1", [1, 0], { text: "first" });
    await index.upsert("2", [0, 1], { text: "second" });

    index.clear();
    expect(index.size()).toBe(0);

    const results = await index.query([1, 0], 5);
    expect(results).toEqual([]);
  });

  it("tracks size correctly", async () => {
    expect(index.size()).toBe(0);

    await index.upsert("1", [1, 0], { text: "first" });
    expect(index.size()).toBe(1);

    await index.upsert("2", [0, 1], { text: "second" });
    expect(index.size()).toBe(2);
  });
});
