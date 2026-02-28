import { describe, it, expect } from "vitest";
import { inferEnergy } from "../../src/brand_matrix/energyInference.js";

describe("inferEnergy", () => {
  it("returns 2 when aggressive", () => {
    const result = inferEnergy({
      aggression: { isAggressive: true, score: 75 },
    });
    expect(result).toBe(2);
  });

  it("returns clamped explicit energy for remix", () => {
    const result = inferEnergy({
      command: "remix",
      explicitEnergy: 4,
    });
    expect(result).toBe(4);
  });

  it("clamps explicit energy to 1-5 range", () => {
    expect(inferEnergy({ command: "remix", explicitEnergy: 10 })).toBe(5);
    expect(inferEnergy({ command: "remix", explicitEnergy: 0 })).toBe(1);
    expect(inferEnergy({ command: "remix", explicitEnergy: -5 })).toBe(1);
  });

  it("minimum 4 for reward replies", () => {
    const result = inferEnergy({
      rewardContext: { isRewardReply: true },
    });
    expect(result).toBeGreaterThanOrEqual(4);
  });

  it("minimum 3 for img command", () => {
    const result = inferEnergy({ command: "img" });
    expect(result).toBeGreaterThanOrEqual(3);
  });

  it("default is 3", () => {
    const result = inferEnergy({});
    expect(result).toBe(3);
  });

  it("boosts energy for lots of emojis", () => {
    const result = inferEnergy({
      text: "Hello!!! 🎉🎉🎉🚀🚀🚀",
    });
    expect(result).toBeGreaterThan(2);
  });

  it("reduces energy for short neutral text", () => {
    const result = inferEnergy({
      text: "ok",
    });
    expect(result).toBeLessThanOrEqual(2);
  });

  it("reduces energy for question-only", () => {
    const result = inferEnergy({
      text: "What is this?",
    });
    expect(result).toBeLessThanOrEqual(2);
  });
});
