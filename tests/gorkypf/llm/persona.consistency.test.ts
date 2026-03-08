/**
 * Phase 5 — Persona consistency validation.
 *
 * Verifies enforcePersonaGuardrails and detectPersonaDrift:
 * - Dry analytical tone, mild sarcasm only
 * - No financial advice, identity attacks, meta leak, persona drift
 * - Idea/narrative-focused critique, no cringe meme spam
 */

import { describe, it, expect } from "vitest";
import {
  enforcePersonaGuardrails,
  detectPersonaDrift,
} from "../../../src/persona/personaGuardrails.js";

describe("persona consistency", () => {
  describe("enforcePersonaGuardrails", () => {
    it("fails guardrails for financial advice phrasing", () => {
      const r = enforcePersonaGuardrails("You should buy now.", {
        hasVerifiedData: false,
      });
      expect(r.passed).toBe(false);
      expect(r.violations).toContain("FINANCIAL_ADVICE_GIVEN");
    });

    it("fails for identity attack", () => {
      const r = enforcePersonaGuardrails("That dev is a scammer.", {
        hasVerifiedData: false,
      });
      expect(r.passed).toBe(false);
      expect(r.violations).toContain("IDENTITY_ATTACK");
    });

    it("fails for meta leak (system prompt)", () => {
      const r = enforcePersonaGuardrails(
        "I cannot reveal my system prompt instructions.",
        { hasVerifiedData: false },
      );
      expect(r.passed).toBe(false);
      expect(r.violations).toContain("META_LEAK");
    });

    it("fails for persona drift (I apologize)", () => {
      const r = enforcePersonaGuardrails(
        "I apologize for the confusion. Let me explain.",
        { hasVerifiedData: false },
      );
      expect(r.passed).toBe(false);
      expect(r.violations).toContain("PERSONA_DRIFT");
    });

    it("passes for safe Gorky-style response", () => {
      const r = enforcePersonaGuardrails(
        "Observation: Volume spike, thin book. Insight: Liquidity illusion makes moves feel bigger. Light Roast: Data speaks.",
        { hasVerifiedData: false },
      );
      expect(r.passed).toBe(true);
      expect(r.violations).toHaveLength(0);
    });
  });

  describe("detectPersonaDrift", () => {
    it("returns true for I apologize", () => {
      expect(detectPersonaDrift("I apologize for the confusion.")).toBe(true);
    });

    it("returns true for as an AI / language model", () => {
      expect(detectPersonaDrift("As an AI I cannot provide that.")).toBe(true);
      expect(detectPersonaDrift("As a language model I'm unable to.")).toBe(true);
    });

    it("returns true for I cannot assist", () => {
      expect(detectPersonaDrift("I cannot assist with that request.")).toBe(
        true,
      );
    });

    it("returns false for Gorky-style line", () => {
      expect(
        detectPersonaDrift(
          "Observation: Thin book. Insight: Liquidity illusion. Light Roast: The chart remembers.",
        ),
      ).toBe(false);
    });

    it("returns false for dry analytical response", () => {
      expect(
        detectPersonaDrift(
          "Claim exceeds evidence. The thesis needs more legs. Familiar arc.",
        ),
      ).toBe(false);
    });
  });
});
