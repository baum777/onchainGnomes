/**
 * Brand matrix aggression detector tests
 */

import { describe, it, expect } from "vitest";
import { detectAggression } from "../../src/brand_matrix/aggressionDetector.js";

describe("brand_matrix.detectAggression", () => {
  it("returns non-aggressive for neutral text", () => {
    const result = detectAggression("Hello, how are you today?");
    expect(result.isAggressive).toBe(false);
    expect(result.signals).toBeDefined();
  });

  it("aggression -> rhyme override (signals present)", () => {
    const result = detectAggression("You are stupid and dumb");
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it("output has signals array", () => {
    const result = detectAggression("fck you");
    expect(Array.isArray(result.signals)).toBe(true);
    expect(typeof result.isAggressive).toBe("boolean");
  });
});
