/**
 * Lore Store - Deterministic Tests
 *
 * Tests for narrative memory storage and retrieval.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createLoreStore, LoreStore, seedLore } from "../../src/memory/loreStore.js";

describe("Lore Store", () => {
  let store: LoreStore;

  beforeEach(async () => {
    store = createLoreStore();
    await store.initialize();
    await store.clear();
  });

  describe("addLore", () => {
    it("should add lore entry", async () => {
      const entry = await store.addLore({
        topic: "origin",
        content: "Born in the liquidity void",
        tags: ["backstory"],
        last_accessed: new Date().toISOString(),
      });

      expect(entry.id).toBeTruthy();
      expect(entry.topic).toBe("origin");
      expect(entry.content).toBe("Born in the liquidity void");
      expect(entry.access_count).toBe(0);
    });

    it("should generate unique IDs for different entries", async () => {
      const entry1 = await store.addLore({
        topic: "origin",
        content: "Content A",
        tags: [],
        last_accessed: new Date().toISOString(),
      });

      const entry2 = await store.addLore({
        topic: "origin",
        content: "Content B",
        tags: [],
        last_accessed: new Date().toISOString(),
      });

      expect(entry1.id).not.toBe(entry2.id);
    });
  });

  describe("getLoreByTopic", () => {
    it("should retrieve lore by topic", async () => {
      await store.addLore({
        topic: "origin",
        content: "Born in the liquidity void",
        tags: [],
        last_accessed: new Date().toISOString(),
      });

      const results = await store.getLoreByTopic("origin");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].topic).toBe("origin");
    });

    it("should update access count on retrieval", async () => {
      const entry = await store.addLore({
        topic: "origin",
        content: "Test",
        tags: [],
        last_accessed: new Date().toISOString(),
      });

      // getLoreByTopic increments access count for each found entry
      const results1 = await store.getLoreByTopic("origin");
      expect(results1[0].access_count).toBe(1);

      // Second access
      const results2 = await store.getLoreByTopic("origin");
      expect(results2[0].access_count).toBe(2);

      // Verify via getLoreById
      const retrieved = await store.getLoreById(entry.id);
      expect(retrieved?.access_count).toBe(3); // getLoreById also increments
    });

    it("should sort by access count", async () => {
      const entry1 = await store.addLore({
        topic: "test",
        content: "Less popular",
        tags: [],
        last_accessed: new Date().toISOString(),
      });

      const entry2 = await store.addLore({
        topic: "test",
        content: "More popular",
        tags: [],
        last_accessed: new Date().toISOString(),
      });

      // Access entry2 more
      await store.getLoreById(entry2.id);
      await store.getLoreById(entry2.id);
      await store.getLoreById(entry2.id);

      const results = await store.getLoreByTopic("test");

      expect(results[0].id).toBe(entry2.id);
    });
  });

  describe("searchLore", () => {
    it("should find lore by content match", async () => {
      await store.addLore({
        topic: "void",
        content: "The liquidity void is my home",
        tags: [],
        last_accessed: new Date().toISOString(),
      });

      const results = await store.searchLore("liquidity");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain("liquidity");
    });

    it("should find lore by tag match", async () => {
      await store.addLore({
        topic: "origin",
        content: "Test content",
        tags: ["backstory", "identity"],
        last_accessed: new Date().toISOString(),
      });

      const results = await store.getLoreByTag("backstory");

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("getPopularLore", () => {
    it("should return most accessed entries", async () => {
      const entry1 = await store.addLore({
        topic: "a",
        content: "A",
        tags: [],
        last_accessed: new Date().toISOString(),
      });

      const entry2 = await store.addLore({
        topic: "b",
        content: "B",
        tags: [],
        last_accessed: new Date().toISOString(),
      });

      // Access entry2 more
      await store.getLoreById(entry2.id);
      await store.getLoreById(entry2.id);

      const popular = await store.getPopularLore(2);

      expect(popular[0].id).toBe(entry2.id);
    });
  });

  describe("hasLore", () => {
    it("should return true for existing topic", async () => {
      await store.addLore({
        topic: "exists",
        content: "Test",
        tags: [],
        last_accessed: new Date().toISOString(),
      });

      const exists = await store.hasLore("exists");
      expect(exists).toBe(true);
    });

    it("should return false for non-existing topic", async () => {
      const exists = await store.hasLore("nonexistent");
      expect(exists).toBe(false);
    });
  });

  describe("seedLore", () => {
    it("should seed initial lore entries", async () => {
      await seedLore(store);

      const allLore = await store.getAllLore();
      expect(allLore.length).toBeGreaterThan(0);

      // Should have origin lore
      const originLore = await store.getLoreByTopic("origin");
      expect(originLore.length).toBeGreaterThan(0);
    });

    it("should not duplicate on re-seed", async () => {
      await seedLore(store);
      const count1 = (await store.getAllLore()).length;

      await seedLore(store);
      const count2 = (await store.getAllLore()).length;

      expect(count1).toBe(count2);
    });
  });

  describe("append-only semantics", () => {
    it("should never delete existing lore", async () => {
      const entry = await store.addLore({
        topic: "permanent",
        content: "This should persist",
        tags: [],
        last_accessed: new Date().toISOString(),
      });

      // Add more lore
      await store.addLore({
        topic: "other",
        content: "Other",
        tags: [],
        last_accessed: new Date().toISOString(),
      });

      // Original should still exist
      const retrieved = await store.getLoreById(entry.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.content).toBe("This should persist");
    });
  });
});
