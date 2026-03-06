import { describe, it, expect } from "vitest";
import { checkEligibility } from "../../src/canonical/eligibility.js";
import { DEFAULT_CANONICAL_CONFIG } from "../../src/canonical/types.js";
import type { ScoreBundle, ClassifierOutput } from "../../src/canonical/types.js";

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

function makeAuditClassifier(overrides: Partial<ClassifierOutput> = {}): ClassifierOutput {
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

describe("eligibility", () => {
  it("allows when all thresholds pass", () => {
    const result = checkEligibility(makeScores(), makeAuditClassifier(), DEFAULT_CANONICAL_CONFIG);
    expect(result.eligible).toBe(true);
    expect(result.skip_reason).toBeNull();
  });

  it("rejects low relevance", () => {
    const result = checkEligibility(
      makeScores({ relevance: 0.2 }),
      makeAuditClassifier(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.eligible).toBe(false);
    expect(result.skip_reason).toBe("skip_low_relevance");
  });

  it("rejects high risk", () => {
    const result = checkEligibility(
      makeScores({ risk: 0.9 }),
      makeAuditClassifier(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.eligible).toBe(false);
    expect(result.skip_reason).toBe("skip_high_risk");
  });

  it("rejects low opportunity", () => {
    const result = checkEligibility(
      makeScores({ opportunity: 0.1 }),
      makeAuditClassifier(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.eligible).toBe(false);
    expect(result.skip_reason).toBe("skip_low_relevance");
  });

  it("rejects low novelty", () => {
    const result = checkEligibility(
      makeScores({ novelty: 0.1 }),
      makeAuditClassifier(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.eligible).toBe(false);
    expect(result.skip_reason).toBe("skip_low_relevance");
  });

  it("rejects very low confidence", () => {
    const result = checkEligibility(
      makeScores({ confidence: 0.1 }),
      makeAuditClassifier(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.eligible).toBe(false);
    expect(result.skip_reason).toBe("skip_low_confidence");
  });

  it("allows borderline scores that pass thresholds", () => {
    const result = checkEligibility(
      makeScores({
        relevance: 0.45,
        risk: 0.55,
        opportunity: 0.40,
        novelty: 0.35,
        confidence: 0.25,
      }),
      makeAuditClassifier(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.eligible).toBe(true);
  });
});
