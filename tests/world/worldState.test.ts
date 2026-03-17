/**
 * Phase-5: World state tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getWorldState, updateWorldState, resetWorldStateStore } from "../../src/world/worldStateStore.js";
import { reduceWorldState } from "../../src/world/worldStateReducer.js";
import { DEFAULT_WORLD_STATE } from "../../src/world/worldState.js";

describe("worldStateStore", () => {
  beforeEach(() => resetWorldStateStore());

  it("returns default state initially", () => {
    const s = getWorldState();
    expect(s.epoch).toBe("1");
    expect(s.civilizationMood).toBe("mocking");
    expect(s.globalHeatLevel).toBe(0.5);
  });

  it("updates state", () => {
    updateWorldState({ civilizationMood: "chaotic", globalHeatLevel: 0.8 });
    const s = getWorldState();
    expect(s.civilizationMood).toBe("chaotic");
    expect(s.globalHeatLevel).toBe(0.8);
  });
});

describe("worldStateReducer", () => {
  it("bounds heat level", () => {
    const updates = reduceWorldState(DEFAULT_WORLD_STATE, {
      marketEnergy: "LOW",
      globalHeatLevel: 1.5,
      timestamp: new Date().toISOString(),
    });
    expect(updates.globalHeatLevel).toBeLessThanOrEqual(1);
  });
});
