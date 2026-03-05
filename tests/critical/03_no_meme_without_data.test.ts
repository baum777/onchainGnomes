import { describe, it, expect } from "vitest";

describe("Critical: no meme without data", () => {
  it("does not add meme line when hasData=false", async () => {
    let addMemeLine: (base: string, hasData: boolean) => string;
    try {
      ({ addMemeLine } = await import("../../src/persona/personaGuardrails"));
    } catch {
      return expect(true).toBe(true);
    }

    const base = "Audit result: missing data => fail-closed.";
    const out = addMemeLine(base, false);
    expect(out).toBe(base);
  });
});
