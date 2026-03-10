import { describe, it, expect } from "vitest";
import {
  extractExpectedKeywords,
  shouldRefine,
  countKeywordsInReply,
} from "../../src/canonical/refineChecker.js";

describe("refineChecker", () => {
  describe("extractExpectedKeywords", () => {
    it("extracts roast keywords from claim text", () => {
      const text = "We have nothing sloppy, concentrated liquidity and inorganic volume";
      const kw = extractExpectedKeywords(text);
      expect(kw).toContain("nothing");
      expect(kw).toContain("sloppy");
      expect(kw).toContain("concentrated");
      expect(kw).toContain("inorganic");
      expect(kw).toContain("volume");
      expect(kw).toContain("liquidity");
    });

    it("includes evidence bullets in extraction", () => {
      const text = "Great launch";
      const bullets = ["slippage concentrated", "wallet distribution"];
      const kw = extractExpectedKeywords(text, bullets);
      expect(kw).toContain("slippage");
      expect(kw).toContain("concentrated");
      expect(kw).toContain("wallet");
    });

    it("adds significant words (≥4 chars) from text", () => {
      const text = "Solanamax launch tokenomics alpha";
      const kw = extractExpectedKeywords(text);
      expect(kw).toContain("alpha");
      expect(kw.some((w) => w.length >= 4)).toBe(true);
    });
  });

  describe("countKeywordsInReply", () => {
    it("counts matching keywords case-insensitively", () => {
      const reply = "Your SLOPPY nothing-burger with concentrated cope.";
      const keywords = ["sloppy", "nothing", "concentrated"];
      expect(countKeywordsInReply(reply, keywords)).toBe(3);
    });

    it("returns 0 when no keywords match", () => {
      const reply = "Generic hype comment.";
      const keywords = ["slippage", "wallet", "inorganic"];
      expect(countKeywordsInReply(reply, keywords)).toBe(0);
    });
  });

  describe("shouldRefine", () => {
    it("returns true when reply is too short", () => {
      expect(shouldRefine("Short.", [], 80, 1)).toBe(true);
      expect(shouldRefine("X".repeat(79), [], 80, 1)).toBe(true);
    });

    it("returns false when reply is long enough and no expected keywords", () => {
      expect(shouldRefine("A".repeat(100), [], 80, 1)).toBe(false);
    });

    it("returns true when reply misses expected keywords", () => {
      const reply = "Generic hype with no specific terms.";
      const keywords = ["sloppy", "concentrated", "wallet"];
      expect(shouldRefine(reply, keywords, 80, 1)).toBe(true);
    });

    it("returns false when reply has enough keywords and length", () => {
      const reply = "Your sloppy concentrated launch screams paper hands. Nothing organic about this volume. Cope.";
      const keywords = ["sloppy", "concentrated"];
      expect(shouldRefine(reply, keywords, 80, 1)).toBe(false);
    });

    it("respects minKeywordCount parameter", () => {
      const reply = "Only sloppy here. Extra words for length."; // 40 chars >= 20, 1 keyword
      const keywords = ["sloppy", "concentrated", "wallet"];
      expect(shouldRefine(reply, keywords, 20, 2)).toBe(true);  // need 2 keywords, have 1
      expect(shouldRefine(reply, keywords, 20, 1)).toBe(false); // need 1 keyword, have 1
    });
  });
});
