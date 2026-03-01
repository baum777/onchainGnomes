import { describe, it, expect } from "vitest";
import { pickTopQueryKeywords } from "../../src/context/ranker.js";

describe("ranker", () => {
  it("prefers tickers first", () => {
    const result = pickTopQueryKeywords(["bitcoin", "$btc", "eth", "$sol"], 4);
    expect(result[0]).toBe("$btc");
    expect(result[1]).toBe("$sol");
    expect(result).toContain("bitcoin");
    expect(result).toContain("eth");
  });

  it("prefers hashtags over generic words", () => {
    const result = pickTopQueryKeywords(["alpha", "crypto", "fud"], 3);
    expect(result).toHaveLength(3);
  });

  it("respects max limit", () => {
    const result = pickTopQueryKeywords(["a", "b", "c", "d", "e"], 2);
    expect(result).toHaveLength(2);
    expect(result).toEqual(["a", "b"]);
  });

  it("returns empty array for empty input", () => {
    const result = pickTopQueryKeywords([], 5);
    expect(result).toEqual([]);
  });
});
