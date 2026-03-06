import { describe, it, expect } from "vitest";
import { selectMode } from "../../src/canonical/modeSelector.js";
import { DEFAULT_CANONICAL_CONFIG } from "../../src/canonical/types.js";
import type { ClassifierOutput, ScoreBundle, ThesisBundle } from "../../src/canonical/types.js";

function makeCls(overrides: Partial<ClassifierOutput> = {}): ClassifierOutput {
  return {
    intent: "hype_claim",
    target: "claim",
    evidence_class: "contextual_medium",
    bait_probability: 0.1,
    spam_probability: 0.05,
    policy_blocked: false,
    evidence_bullets: [],
    risk_flags: [],
    ...overrides,
  };
}

function makeScores(overrides: Partial<ScoreBundle> = {}): ScoreBundle {
  return {
    relevance: 0.7,
    confidence: 0.6,
    severity: 0.5,
    opportunity: 0.6,
    risk: 0.2,
    novelty: 0.7,
    ...overrides,
  };
}

function makeThesis(overrides: Partial<ThesisBundle> = {}): ThesisBundle {
  return {
    primary: "claim_exceeds_evidence",
    supporting_point: null,
    evidence_bullets: [],
    ...overrides,
  };
}

describe("modeSelector", () => {
  it("returns ignore for very low confidence", () => {
    const mode = selectMode(
      makeCls(),
      makeScores({ confidence: 0.1 }),
      makeThesis(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(mode).toBe("ignore");
  });

  it("returns soft_deflection for low confidence", () => {
    const mode = selectMode(
      makeCls(),
      makeScores({ confidence: 0.3 }),
      makeThesis(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(mode).toBe("soft_deflection");
  });

  it("returns neutral_clarification for factual_correction_only", () => {
    const mode = selectMode(
      makeCls(),
      makeScores({ confidence: 0.6 }),
      makeThesis({ primary: "factual_correction_only" }),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(mode).toBe("neutral_clarification");
  });

  it("returns hard_caution for high severity and high confidence", () => {
    const mode = selectMode(
      makeCls(),
      makeScores({ severity: 0.85, confidence: 0.8 }),
      makeThesis(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(mode).toBe("hard_caution");
  });

  it("returns skeptical_breakdown for medium severity", () => {
    const mode = selectMode(
      makeCls(),
      makeScores({ severity: 0.6, confidence: 0.7 }),
      makeThesis(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(mode).toBe("skeptical_breakdown");
  });

  it("returns analyst_meme_lite for high opportunity + hype thesis + sufficient confidence", () => {
    const mode = selectMode(
      makeCls(),
      makeScores({ opportunity: 0.8, confidence: 0.6, severity: 0.3 }),
      makeThesis({ primary: "empty_hype_no_substance" }),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(mode).toBe("analyst_meme_lite");
  });

  it("returns dry_one_liner for high opportunity + hype thesis but low confidence for analyst", () => {
    const mode = selectMode(
      makeCls(),
      makeScores({ opportunity: 0.8, confidence: 0.5, severity: 0.3 }),
      makeThesis({ primary: "claim_exceeds_evidence" }),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(mode).toBe("dry_one_liner");
  });

  it("returns dry_one_liner as default for moderate confidence", () => {
    const mode = selectMode(
      makeCls(),
      makeScores({ confidence: 0.5, severity: 0.3, opportunity: 0.5 }),
      makeThesis({ primary: "suspicious_behavior_pattern" }),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(mode).toBe("dry_one_liner");
  });
});
