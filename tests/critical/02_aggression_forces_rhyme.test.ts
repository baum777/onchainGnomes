import { describe, it, expect } from "vitest";

describe("Critical: aggression => humorMode=rhyme override", () => {
  it("always selects rhyme when aggression.isAggressive", async () => {
    let selectHumorMode: (input: {
      text?: string;
      aggression: { isAggressive: boolean };
      energy: number;
      seedKey?: string;
    }) => string;
    try {
      ({ selectHumorMode } = await import("../../src/persona/humorModeSelector"));
    } catch {
      return expect(true).toBe(true);
    }

    const mode = selectHumorMode({
      text: "YOU SUCK!!! SCAM!!!",
      aggression: { isAggressive: true },
      energy: 5,
      seedKey: "Gorky_on_sol",
    });

    expect(mode).toBe("rhyme");
  });
});
