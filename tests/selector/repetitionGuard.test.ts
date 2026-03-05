/**
 * Repetition Guard - Deterministic Tests
 *
 * Tests for anti-repetition functionality.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  RepetitionGuard,
  createRepetitionGuard,
  isExactMatch,
  quickSimilarity,
} from "../../src/selector/repetitionGuard.js";

describe("Repetition Guard", () => {
  let guard: RepetitionGuard;

  beforeEach(() => {
    guard = createRepetitionGuard({
      maxCacheSize: 10,
      ttlMs: 60000, // 1 minute for tests
      similarityThreshold: 0.6,
    });
  });

  describe("exact match detection", () => {
    it("should detect exact match", () => {
      const reply = "Need the real CA to verify anything.";
      guard.add(reply);

      const check = guard.check(reply);

      expect(check.is_repetitive).toBe(true);
      expect(check.similarity_score).toBe(1.0);
      expect(check.penalty_factor).toBe(0.1);
    });

    it("should detect case-insensitive exact match", () => {
      guard.add("Need the REAL ca to VERIFY anything.");

      const check = guard.check("need the real ca to verify anything.");

      expect(check.is_repetitive).toBe(true);
    });

    it("should not flag different replies", () => {
      guard.add("Reply one about liquidity");

      const check = guard.check("Reply two about volume");

      expect(check.is_repetitive).toBe(false);
      expect(check.penalty_factor).toBe(1.0);
    });
  });

  describe("similarity detection", () => {
    it("should calculate similarity score", () => {
      guard.add("Need the real CA to verify anything before investing in this token here now.");

      // Very similar structure with only minor word changes
      const check = guard.check("Need the real CA to verify everything before investing in this token here now.");

      // With 3-gram similarity, very similar sentences should have non-zero similarity
      expect(check.similarity_score).toBeGreaterThan(0);
      expect(check.similarity_score).toBeLessThanOrEqual(1);
    });

    it("should allow similar but sufficiently different replies", () => {
      guard.add("Data suggests liquidity is thin right now.");

      const check = guard.check("Volume looks low on the charts.");

      expect(check.is_repetitive).toBe(false);
    });
  });

  describe("cache management", () => {
    it("should track multiple entries", () => {
      guard.add("Reply one");
      guard.add("Reply two");
      guard.add("Reply three");

      const stats = guard.getStats();

      expect(stats.size).toBe(3);
    });

    it("should evict oldest when over capacity", () => {
      const smallGuard = createRepetitionGuard({
        maxCacheSize: 2,
        ttlMs: 60000,
      });

      smallGuard.add("First reply");
      smallGuard.add("Second reply");
      smallGuard.add("Third reply"); // Should evict first

      const check = smallGuard.check("First reply");

      expect(check.is_repetitive).toBe(false); // Was evicted
      expect(smallGuard.getStats().size).toBe(2);
    });

    it("should increment use count on duplicate adds", () => {
      const reply = "Test reply";
      guard.add(reply);
      guard.add(reply);

      const entries = guard.getAll();
      const entry = entries.find(e => e.text === reply);

      expect(entry?.useCount).toBe(2);
    });
  });

  describe("utility functions", () => {
    it("isExactMatch should handle case and whitespace", () => {
      expect(isExactMatch("Hello", "hello")).toBe(true);
      expect(isExactMatch("Hello ", "hello")).toBe(true);
      expect(isExactMatch("Hello", "World")).toBe(false);
    });

    it("quickSimilarity should calculate word overlap", () => {
      const sim1 = quickSimilarity(
        "the quick brown fox",
        "the quick brown dog"
      );
      expect(sim1).toBeGreaterThan(0.5);

      const sim2 = quickSimilarity(
        "completely different text",
        "nothing alike here"
      );
      expect(sim2).toBeLessThan(0.3);
    });
  });
});
