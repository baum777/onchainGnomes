import { describe, it, expect } from "vitest";
import { extractKeywords } from "../../src/context/keywordExtractor.js";
import type { TweetRef } from "../../src/context/types.js";

describe("keywordExtractor", () => {
  const chain = (texts: string[]): TweetRef[] =>
    texts.map((text, i) => ({ id: `t${i}`, text }));

  it("extracts handles without @ prefix in output", () => {
    const result = extractKeywords(chain(["Hello @alice and @bob_123"]));
    expect(result.entities).toContain("alice");
    expect(result.entities).toContain("bob_123");
  });

  it("extracts hashtags without # prefix", () => {
    const result = extractKeywords(chain(["#bitcoin #eth to the moon"]));
    expect(result.entities).toContain("bitcoin");
    expect(result.entities).toContain("eth");
  });

  it("extracts tickers (with $ preserved for ranker)", () => {
    const result = extractKeywords(chain(["$BTC $SOL pumping"]));
    expect(result.entities).toContain("$btc");
    expect(result.entities).toContain("$sol");
  });

  it("prefers tickers and hashtags in entities", () => {
    const result = extractKeywords(chain(["@user talking about $BTC and #crypto"]));
    expect(result.entities.length).toBeGreaterThan(0);
    expect(result.keywords.length).toBeGreaterThanOrEqual(result.entities.length);
  });

  it("deduplicates entities and keywords", () => {
    const result = extractKeywords(chain(["@alice @alice @alice"]));
    const aliceCount = result.entities.filter((e) => e === "alice").length;
    expect(aliceCount).toBe(1);
  });

  it("limits entities to 20 and keywords to 40", () => {
    const many = Array.from({ length: 30 }, (_, i) => `@user${i} $TKN${i}`);
    const result = extractKeywords(chain(many));
    expect(result.entities.length).toBeLessThanOrEqual(20);
    expect(result.keywords.length).toBeLessThanOrEqual(40);
  });
});
