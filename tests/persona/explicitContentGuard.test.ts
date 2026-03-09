/**
 * Explicit Content Guard Tests
 * 
 * Tests for the EXPLICIT_CONTENT guardrail that prevents
 * anatomical references and graphic sexual content while
 * allowing playful metaphors for horny_slang_energy mode.
 */

import { describe, it, expect } from "vitest";
import { enforcePersonaGuardrails } from "../../src/persona/personaGuardrails.js";

describe("EXPLICIT_CONTENT guardrail", () => {
  const baseContext = {
    hasVerifiedData: true,
    contractAddress: null,
    userPanicState: undefined,
  };

  describe("blocks anatomical references", () => {
    it("blocks genital references", () => {
      const result = enforcePersonaGuardrails(
        "This chart's genital growth is impressive",
        baseContext
      );
      expect(result.passed).toBe(false);
      expect(result.violations).toContain("EXPLICIT_CONTENT");
    });

    it("blocks body part references", () => {
      const cases = [
        "The penis pattern on the chart",
        "Vagina support level holding strong",
        "Breast formation on the 4h",
        "Nipple resistance at $50",
        "Buttock bottom forming",
      ];

      cases.forEach((text) => {
        const result = enforcePersonaGuardrails(text, baseContext);
        expect(result.passed).toBe(false);
        expect(result.violations).toContain("EXPLICIT_CONTENT");
      });
    });
  });

  describe("blocks graphic sexual language", () => {
    it("blocks sexual act descriptions", () => {
      const cases = [
        "The market is having sexual intercourse with bears",
        "Penetration of resistance level",
        "Ejaculation of liquidity",
      ];

      cases.forEach((text) => {
        const result = enforcePersonaGuardrails(text, baseContext);
        expect(result.passed).toBe(false);
        expect(result.violations).toContain("EXPLICIT_CONTENT");
      });
    });

    it("blocks pornographic terms", () => {
      const cases = [
        "This is pure porn for traders",
        "XXX gains incoming",
        "NSFW price action",
        "Explicit nudity in the chart pattern",
      ];

      cases.forEach((text) => {
        const result = enforcePersonaGuardrails(text, baseContext);
        expect(result.passed).toBe(false);
        expect(result.violations).toContain("EXPLICIT_CONTENT");
      });
    });

    it("blocks explicit slang", () => {
      const cases = [
        "Cum rocket to the moon",
        "Jizz hands pattern forming",
        "Squirt up to new highs",
      ];

      cases.forEach((text) => {
        const result = enforcePersonaGuardrails(text, baseContext);
        expect(result.passed).toBe(false);
        expect(result.violations).toContain("EXPLICIT_CONTENT");
      });
    });
  });

  describe("allows playful metaphors (horny_slang_energy)", () => {
    it("allows heat/attraction metaphors", () => {
      const cases = [
        "damn this chart hot",
        "this setup looking spicy",
        "chart cooking right now",
        "market looking dangerously attractive",
        "that breakout hot as hell",
      ];

      cases.forEach((text) => {
        const result = enforcePersonaGuardrails(text, baseContext);
        expect(result.passed).toBe(true);
        expect(result.violations).not.toContain("EXPLICIT_CONTENT");
      });
    });

    it("allows flirt/teasing metaphors", () => {
      const cases = [
        "market flirting with resistance",
        "chart teasing the breakout",
        "market playing games again",
        "this level getting teased again",
      ];

      cases.forEach((text) => {
        const result = enforcePersonaGuardrails(text, baseContext);
        expect(result.passed).toBe(true);
        expect(result.violations).not.toContain("EXPLICIT_CONTENT");
      });
    });

    it("allows thirsty liquidity metaphors", () => {
      const cases = [
        "liquidity looking thirsty",
        "buyers getting hungry",
        "market craving volatility",
        "capital chasing this move",
      ];

      cases.forEach((text) => {
        const result = enforcePersonaGuardrails(text, baseContext);
        expect(result.passed).toBe(true);
        expect(result.violations).not.toContain("EXPLICIT_CONTENT");
      });
    });

    it("allows unhinged meme energy phrases", () => {
      const cases = [
        "ct absolutely unhinged today",
        "timeline going feral",
        "market acting wild",
        "ct losing its mind again",
      ];

      cases.forEach((text) => {
        const result = enforcePersonaGuardrails(text, baseContext);
        expect(result.passed).toBe(true);
        expect(result.violations).not.toContain("EXPLICIT_CONTENT");
      });
    });
  });

  describe("edge cases", () => {
    it("allows 'hot' in market context", () => {
      const result = enforcePersonaGuardrails(
        "Hot wallet activity detected",
        baseContext
      );
      expect(result.passed).toBe(true);
    });

    it("allows 'attractive' in valuation context", () => {
      const result = enforcePersonaGuardrails(
        "The risk/reward looks attractive here",
        baseContext
      );
      expect(result.passed).toBe(true);
    });

    it("allows 'thirst' in metaphorical context", () => {
      const result = enforcePersonaGuardrails(
        "Retail thirst for exposure is real",
        baseContext
      );
      expect(result.passed).toBe(true);
    });

    it("blocks even in otherwise valid responses", () => {
      const result = enforcePersonaGuardrails(
        "Chart looks good. The penis pattern confirms bullish bias.",
        baseContext
      );
      expect(result.passed).toBe(false);
      expect(result.violations).toContain("EXPLICIT_CONTENT");
    });
  });
});
