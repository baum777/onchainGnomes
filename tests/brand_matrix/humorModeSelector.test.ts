import { describe, it, expect } from "vitest";
import { selectHumorMode, selectModeForMention } from "../../src/brand_matrix/humorModeSelector.js";

describe("selectHumorMode", () => {
  it("always returns 'rhyme' when aggressive", () => {
    const result = selectHumorMode({
      energy: 5,
      aggression: { isAggressive: true },
    });
    expect(result).toBe("rhyme");
  });

  it("returns valid mode for energy 5", () => {
    const result = selectHumorMode({
      energy: 5,
      aggression: { isAggressive: false },
    });
    expect(["goblin", "authority"]).toContain(result);
  });

  it("is deterministic for same inputs", () => {
    const input = { energy: 4 as const, aggression: { isAggressive: false }, command: "remix" };
    const r1 = selectHumorMode(input);
    const r2 = selectHumorMode(input);
    expect(r1).toBe(r2);
  });
});

describe("selectModeForMention", () => {
  it("returns rhyme when aggressive", () => {
    const result = selectModeForMention(3, true);
    expect(result).toBe("rhyme");
  });
});
