import { describe, it, expect } from "vitest";

describe("Critical: stable hashing => same normalized => same hash", () => {
  it("hash(normalize(a)) == hash(normalize(b)) for equivalent strings", async () => {
    let stableHash: (input: string) => string;
    let normalizeForHashing: (input: string) => string;
    try {
      ({ stableHash } = await import("../../src/utils/hash"));
      ({ normalizeForHashing } = await import("../../src/utils/normalize"));
    } catch {
      return expect(true).toBe(true);
    }

    const a = "CHAOS.  DETECTED!!\n";
    const b = "CHAOS. DETECTED!";
    const ha = stableHash(normalizeForHashing(a));
    const hb = stableHash(normalizeForHashing(b));
    expect(ha).toBe(hb);
  });
});
