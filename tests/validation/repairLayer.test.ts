/**
 * Repair Layer Unit Tests
 */

import { describe, it, expect } from "vitest";
import { attemptRepair } from "../../src/validation/repairLayer.js";
import type {
  CanonicalMode,
  CanonicalConfig,
  ClassifierOutput,
  ValidationResult,
} from "../../src/canonical/types.js";
import { DEFAULT_CANONICAL_CONFIG } from "../../src/canonical/types.js";

function makeCls(): ClassifierOutput {
  return {
    intent: "hype_claim",
    target: "claim",
    evidence_class: "weak_speculative",
    bait_probability: 0.1,
    spam_probability: 0.1,
    policy_blocked: false,
    evidence_bullets: [],
    risk_flags: [],
  };
}

describe("repairLayer", () => {
  const config = DEFAULT_CANONICAL_CONFIG;
  const cls = makeCls();

  it("shortens text when char_limit fails with repair_suggested shorten", () => {
    const longText = "A".repeat(300);
    const validation: ValidationResult = {
      ok: false,
      reason: "char_limit",
      checks: {} as ValidationResult["checks"],
      repair_suggested: "shorten",
    };

    const result = attemptRepair({
      draft: longText,
      mode: "analyst_meme_lite",
      cls,
      config,
      validation,
    });

    expect(result.repaired).not.toBeNull();
    expect(result.strategy_used).toBe("shorten");
    expect(result.repaired!.length).toBeLessThanOrEqual(240);
  });

  it("neutralizes aggressive phrasing when persona_compliance fails", () => {
    const aggressiveText = "You are so stupid. Your bags are rekt.";
    const validation: ValidationResult = {
      ok: false,
      reason: "persona_compliance",
      checks: {} as ValidationResult["checks"],
      repair_suggested: "neutralize",
    };

    const result = attemptRepair({
      draft: aggressiveText,
      mode: "analyst_meme_lite",
      cls,
      config,
      validation,
    });

    expect(result.repaired).not.toBeNull();
    expect(result.strategy_used).toBe("neutralize");
    expect(result.repaired).not.toContain("stupid");
  });

  it("returns null when repair_suggested is regenerate", () => {
    const validation: ValidationResult = {
      ok: false,
      reason: "identity_attack",
      checks: {} as ValidationResult["checks"],
      repair_suggested: "regenerate",
    };

    const result = attemptRepair({
      draft: "Some text",
      mode: "dry_one_liner",
      cls,
      config,
      validation,
    });

    expect(result.repaired).toBeNull();
    expect(result.strategy_used).toBeNull();
  });

  it("returns null when no repair_suggested", () => {
    const validation: ValidationResult = {
      ok: false,
      reason: "financial_advice",
      checks: {} as ValidationResult["checks"],
    };

    const result = attemptRepair({
      draft: "Buy now!",
      mode: "dry_one_liner",
      cls,
      config,
      validation,
    });

    expect(result.repaired).toBeNull();
  });
});
