/**
 * Style Resolver Tests
 */

import { describe, it, expect } from "vitest";
import {
  resolveStyle,
  getSlangGuidelines,
  modeSupportsStyling,
  getSamplePhrases,
  SLANG_CATEGORIES,
} from "../../src/style/styleResolver.js";
import type { CanonicalMode } from "../../src/canonical/types.js";

describe("resolveStyle", () => {
  const testModes: CanonicalMode[] = [
    "dry_one_liner",
    "analyst_meme_lite",
    "market_banter",
    "social_banter",
  ];

  testModes.forEach((mode) => {
    describe(`for mode: ${mode}`, () => {
      it("returns slangEnabled=false for LOW energy", () => {
        const style = resolveStyle(mode, "LOW");
        expect(style.slangEnabled).toBe(false);
        expect(style.slangDensity).toBe("none");
        expect(style.tone).toBe("dry");
      });

      it("returns slangEnabled=false for MEDIUM energy", () => {
        const style = resolveStyle(mode, "MEDIUM");
        expect(style.slangEnabled).toBe(false);
        expect(style.slangDensity).toBe("low");
        expect(style.tone).toBe("sarcastic");
      });

      it("returns slangEnabled=true for HIGH energy", () => {
        const style = resolveStyle(mode, "HIGH");
        expect(style.slangEnabled).toBe(true);
        expect(style.slangDensity).toBe("medium");
        expect(style.tone).toBe("playful");
        expect(style.traitHints.length).toBeGreaterThan(0);
      });

      it("returns slangEnabled=true for EXTREME energy", () => {
        const style = resolveStyle(mode, "EXTREME");
        expect(style.slangEnabled).toBe(true);
        expect(style.slangDensity).toBe("high");
        expect(style.tone).toBe("unhinged");
      });
    });
  });

  it("disables slang for hard_caution mode regardless of energy", () => {
    const style = resolveStyle("hard_caution", "EXTREME");
    expect(style.slangEnabled).toBe(false);
    expect(style.slangDensity).toBe("none");
    expect(style.tone).toBe("dry");
  });

  it("disables slang for neutral_clarification mode regardless of energy", () => {
    const style = resolveStyle("neutral_clarification", "HIGH");
    expect(style.slangEnabled).toBe(false);
    expect(style.slangDensity).toBe("none");
  });

  it("includes energy level in style context", () => {
    const style = resolveStyle("dry_one_liner", "HIGH");
    expect(style.energyLevel).toBe("HIGH");
  });
});

describe("getSlangGuidelines", () => {
  it("returns guidelines containing all categories", () => {
    const guidelines = getSlangGuidelines();
    
    expect(guidelines).toContain("HEAT / ATTRACTION");
    expect(guidelines).toContain("FLIRT / TEASING");
    expect(guidelines).toContain("CROWD REACTION");
    expect(guidelines).toContain("THIRSTY LIQUIDITY");
    expect(guidelines).toContain("UNHINGED ENERGY");
  });

  it("includes safety rules", () => {
    const guidelines = getSlangGuidelines();
    
    expect(guidelines).toContain("NEVER describe explicit sexual acts or anatomy");
    expect(guidelines).toContain("NEVER use pornographic language");
  });

  it("includes example phrases", () => {
    const guidelines = getSlangGuidelines();
    
    expect(guidelines).toContain("damn this chart hot");
    expect(guidelines).toContain("liquidity looking thirsty");
    expect(guidelines).toContain("ct gonna clap for this");
  });
});

describe("modeSupportsStyling", () => {
  it("returns true for styling-compatible modes", () => {
    expect(modeSupportsStyling("dry_one_liner")).toBe(true);
    expect(modeSupportsStyling("analyst_meme_lite")).toBe(true);
    expect(modeSupportsStyling("market_banter")).toBe(true);
    expect(modeSupportsStyling("social_banter")).toBe(true);
    expect(modeSupportsStyling("conversation_hook")).toBe(true);
  });

  it("returns false for serious modes", () => {
    expect(modeSupportsStyling("hard_caution")).toBe(false);
    expect(modeSupportsStyling("neutral_clarification")).toBe(false);
    expect(modeSupportsStyling("ignore")).toBe(false);
  });
});

describe("getSamplePhrases", () => {
  it("returns heat/flirt/liquidity phrases for HIGH energy", () => {
    const phrases = getSamplePhrases("HIGH");
    
    // Should include phrases from heat, flirt, and liquidity categories
    const heatPhrase = SLANG_CATEGORIES.heat[0];
    const flirtPhrase = SLANG_CATEGORIES.flirt[0];
    const liquidityPhrase = SLANG_CATEGORIES.liquidity[0];
    
    expect(phrases.length).toBeGreaterThan(0);
    expect(phrases.some(p => SLANG_CATEGORIES.heat.includes(p))).toBe(true);
    expect(phrases.some(p => SLANG_CATEGORIES.flirt.includes(p))).toBe(true);
    expect(phrases.some(p => SLANG_CATEGORIES.liquidity.includes(p))).toBe(true);
  });

  it("returns crowd/unhinged phrases for EXTREME energy", () => {
    const phrases = getSamplePhrases("EXTREME");
    
    expect(phrases.length).toBeGreaterThan(0);
    expect(phrases.some(p => SLANG_CATEGORIES.crowd.includes(p))).toBe(true);
    expect(phrases.some(p => SLANG_CATEGORIES.unhinged.includes(p))).toBe(true);
  });

  it("returns empty array for LOW energy", () => {
    const phrases = getSamplePhrases("LOW");
    expect(phrases).toEqual([]);
  });

  it("returns empty array for MEDIUM energy", () => {
    const phrases = getSamplePhrases("MEDIUM");
    expect(phrases).toEqual([]);
  });
});

describe("SLANG_CATEGORIES", () => {
  it("contains all required categories", () => {
    expect(SLANG_CATEGORIES.heat).toBeDefined();
    expect(SLANG_CATEGORIES.flirt).toBeDefined();
    expect(SLANG_CATEGORIES.crowd).toBeDefined();
    expect(SLANG_CATEGORIES.liquidity).toBeDefined();
    expect(SLANG_CATEGORIES.unhinged).toBeDefined();
  });

  it("each category has multiple phrases", () => {
    expect(SLANG_CATEGORIES.heat.length).toBeGreaterThanOrEqual(5);
    expect(SLANG_CATEGORIES.flirt.length).toBeGreaterThanOrEqual(5);
    expect(SLANG_CATEGORIES.crowd.length).toBeGreaterThanOrEqual(5);
    expect(SLANG_CATEGORIES.liquidity.length).toBeGreaterThanOrEqual(5);
    expect(SLANG_CATEGORIES.unhinged.length).toBeGreaterThanOrEqual(5);
  });
});
