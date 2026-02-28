/**
 * rollDice — Deterministic PRNG tests
 */

import { describe, it, expect } from "vitest";
import { rollDice } from "../../src/utils/rollDice.js";

describe("rollDice", () => {
  it("is deterministic for same seed", () => {
    const seed = "event_123";
    const dice1 = rollDice(seed);
    const dice2 = rollDice(seed);

    const floats1 = [dice1.float(), dice1.float(), dice1.float()];
    const floats2 = [dice2.float(), dice2.float(), dice2.float()];

    expect(floats1).toEqual(floats2);
  });

  it("float returns values in [0, 1)", () => {
    const dice = rollDice("test");
    for (let i = 0; i < 20; i++) {
      const v = dice.float();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int returns inclusive range", () => {
    const dice = rollDice("int_test");
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const v = dice.int(1, 5);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(5);
      seen.add(v);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("pick returns from array deterministically", () => {
    const arr = ["a", "b", "c"];
    const dice = rollDice("pick_seed");
    const results = [dice.pick(arr), dice.pick(arr), dice.pick(arr)];
    const dice2 = rollDice("pick_seed");
    const results2 = [dice2.pick(arr), dice2.pick(arr), dice2.pick(arr)];
    expect(results).toEqual(results2);
  });

  it("chance is deterministic for same seed", () => {
    const dice = rollDice("chance_seed");
    const results = [dice.chance(0.5), dice.chance(0.5), dice.chance(0.3)];
    const dice2 = rollDice("chance_seed");
    const results2 = [dice2.chance(0.5), dice2.chance(0.5), dice2.chance(0.3)];
    expect(results).toEqual(results2);
  });
});
