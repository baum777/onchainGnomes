import { describe, it, expect } from "vitest";
import { detectAggression, shouldUseRhymeMode } from "../../src/safety/aggressionDetector.js";

describe("detectAggression", () => {
  it("returns non-aggressive for neutral text", () => {
    const result = detectAggression({ text: "Hello, how are you today?" });
    expect(result.isAggressive).toBe(false);
    expect(result.score).toBeLessThan(60);
  });

  it("detects aggressive keywords", () => {
    const result = detectAggression({ text: "You are stupid and dumb" });
    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons).toContain("aggressive_keywords:2");
  });

  it("returns score in 0-100 range", () => {
    const result = detectAggression({ text: "fck you stupid bot" });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe("shouldUseRhymeMode", () => {
  it("returns true when aggressive", () => {
    const signal = detectAggression({ text: "You are stupid" });
    expect(shouldUseRhymeMode(signal)).toBe(signal.isAggressive);
  });
});
