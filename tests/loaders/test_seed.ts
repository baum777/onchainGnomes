import { describe, it, expect } from "vitest";
import { seedFromString, createSeededRNG } from "../../src/loaders/seed.js";

describe("seed", () => {
  describe("seedFromString", () => {
    it("produces consistent numeric output", () => {
      const seed1 = seedFromString("test_string_123");
      const seed2 = seedFromString("test_string_123");

      expect(seed1).toBe(seed2);
    });

    it("produces different output for different strings", () => {
      const seed1 = seedFromString("string_a");
      const seed2 = seedFromString("string_b");

      expect(seed1).not.toBe(seed2);
    });

    it("produces positive integers", () => {
      const seed = seedFromString("any_string");

      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
    });
  });

  describe("createSeededRNG", () => {
    it("returns a function", () => {
      const rng = createSeededRNG("seed");

      expect(typeof rng).toBe("function");
    });

    it("produces numbers in [0, 1)", () => {
      const rng = createSeededRNG("seed");
      const value = rng();

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });

    it("produces deterministic sequence", () => {
      const rng1 = createSeededRNG("same_seed");
      const rng2 = createSeededRNG("same_seed");

      const seq1 = [rng1(), rng1(), rng1()];
      const seq2 = [rng2(), rng2(), rng2()];

      expect(seq1).toEqual(seq2);
    });

    it("produces different sequences for different seeds", () => {
      const rng1 = createSeededRNG("seed_1");
      const rng2 = createSeededRNG("seed_2");

      expect(rng1()).not.toBe(rng2());
    });

    it("produces uniform-ish distribution", () => {
      const rng = createSeededRNG("distribution_test");
      const values: number[] = [];

      for (let i = 0; i < 1000; i++) {
        values.push(rng());
      }

      const mean = values.reduce((a, b) => a + b, 0) / values.length;

      // Mean should be close to 0.5
      expect(mean).toBeGreaterThan(0.4);
      expect(mean).toBeLessThan(0.6);
    });
  });
});
