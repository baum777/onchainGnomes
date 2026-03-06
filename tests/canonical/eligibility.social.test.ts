import { describe, it, expect } from "vitest";
import { checkEligibility } from "../../src/canonical/eligibility.js";
import { DEFAULT_CANONICAL_CONFIG } from "../../src/canonical/types.js";
import type { ScoreBundle, ClassifierOutput } from "../../src/canonical/types.js";

function makeScores(overrides: Partial<ScoreBundle> = {}): ScoreBundle {
  return {
    relevance: 0.05,
    confidence: 0.01,
    severity: 0.1,
    opportunity: 0.1,
    risk: 0.10,
    novelty: 0.1,
    ...overrides,
  };
}

function makeCls(overrides: Partial<ClassifierOutput> = {}): ClassifierOutput {
  return {
    intent: "greeting",
    target: "conversation",
    evidence_class: "absent",
    bait_probability: 0,
    spam_probability: 0,
    policy_blocked: false,
    policy_severity: "none",
    policy_reasons: [],
    evidence_bullets: [],
    risk_flags: [],
    ...overrides,
  };
}

describe("eligibility — social path", () => {
  it("allows greeting with minimal scores", () => {
    const result = checkEligibility(
      makeScores({ relevance: 0.05, confidence: 0.01, risk: 0.10 }),
      makeCls({ intent: "greeting" }),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.eligible).toBe(true);
    expect(result.skip_reason).toBeNull();
  });

  it("allows casual_ping with minimal scores", () => {
    const result = checkEligibility(
      makeScores({ relevance: 0.05, confidence: 0.01, risk: 0.10 }),
      makeCls({ intent: "casual_ping", target: "conversation" }),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.eligible).toBe(true);
    expect(result.skip_reason).toBeNull();
  });

  it("allows market_question_general (altseason case)", () => {
    const result = checkEligibility(
      makeScores({ relevance: 0.45, confidence: 0.20, risk: 0.25, opportunity: 0.55, novelty: 0.70 }),
      makeCls({ intent: "market_question_general", target: "market_structure" }),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.eligible).toBe(true);
    expect(result.skip_reason).toBeNull();
  });

  it("allows persona_query with low evidence", () => {
    const result = checkEligibility(
      makeScores({ relevance: 0.20, confidence: 0.15, risk: 0.10 }),
      makeCls({ intent: "persona_query", target: "persona" }),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.eligible).toBe(true);
  });

  it("allows lore_query with low evidence", () => {
    const result = checkEligibility(
      makeScores({ relevance: 0.20, confidence: 0.10, risk: 0.10 }),
      makeCls({ intent: "lore_query", target: "lore" }),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.eligible).toBe(true);
  });

  it("blocks greeting with hard policy", () => {
    const result = checkEligibility(
      makeScores(),
      makeCls({ intent: "greeting", policy_blocked: true, policy_severity: "hard" }),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.eligible).toBe(false);
    expect(result.skip_reason).toBe("skip_policy");
  });

  it("blocks social intent with high risk", () => {
    const result = checkEligibility(
      makeScores({ risk: 0.9 }),
      makeCls({ intent: "greeting" }),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.eligible).toBe(false);
    expect(result.skip_reason).toBe("skip_high_risk");
  });

  it("still rejects audit case with low relevance", () => {
    const result = checkEligibility(
      makeScores({ relevance: 0.30, confidence: 0.20 }),
      makeCls({ intent: "performance_claim", target: "claim", evidence_class: "weak_speculative" }),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.eligible).toBe(false);
    expect(result.skip_reason).toBe("skip_low_relevance");
  });

  it("social question path uses relaxed thresholds", () => {
    const result = checkEligibility(
      makeScores({ relevance: 0.20, confidence: 0.10, opportunity: 0.10, novelty: 0.05, risk: 0.1 }),
      makeCls({ intent: "question", target: "claim" }),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.eligible).toBe(true);
  });

  it("allows soft policy for greeting (not hard block)", () => {
    const result = checkEligibility(
      makeScores(),
      makeCls({ intent: "greeting", policy_blocked: false, policy_severity: "soft", policy_reasons: ["low_content"] }),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.eligible).toBe(true);
  });
});
