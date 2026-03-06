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
    relevance: 0.5,
    confidence: 0.3,
    severity: 0.2,
    opportunity: 0.5,
    risk: 0.1,
    novelty: 0.5,
    ...overrides,
  };
}

function makeThesis(overrides: Partial<ThesisBundle> = {}): ThesisBundle {
  return {
    primary: "social_engagement",
    supporting_point: null,
    evidence_bullets: [],
    ...overrides,
  };
}

describe("modeSelector — social routing", () => {
  it("greeting maps to social_banter", () => {
    const mode = selectMode(
      makeCls({ intent: "greeting" }),
      makeScores({ confidence: 0.01 }),
      makeThesis(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(mode).toBe("social_banter");
  });

  it("casual_ping maps to conversation_hook", () => {
    const mode = selectMode(
      makeCls({ intent: "casual_ping" }),
      makeScores({ confidence: 0.01 }),
      makeThesis(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(mode).toBe("conversation_hook");
  });

  it("market_question_general maps to market_banter", () => {
    const mode = selectMode(
      makeCls({ intent: "market_question_general" }),
      makeScores(),
      makeThesis(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(mode).toBe("market_banter");
  });

  it("persona_query maps to persona_reply", () => {
    const mode = selectMode(
      makeCls({ intent: "persona_query" }),
      makeScores(),
      makeThesis(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(mode).toBe("persona_reply");
  });

  it("lore_query maps to lore_drop", () => {
    const mode = selectMode(
      makeCls({ intent: "lore_query" }),
      makeScores(),
      makeThesis(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(mode).toBe("lore_drop");
  });

  it("conversation_continue maps to conversation_hook", () => {
    const mode = selectMode(
      makeCls({ intent: "conversation_continue" }),
      makeScores(),
      makeThesis(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(mode).toBe("conversation_hook");
  });

  it("no social intent maps to ignore", () => {
    const socialIntents = [
      "greeting",
      "casual_ping",
      "market_question_general",
      "persona_query",
      "lore_query",
      "conversation_continue",
    ] as const;

    for (const intent of socialIntents) {
      const mode = selectMode(
        makeCls({ intent }),
        makeScores({ confidence: 0.01 }),
        makeThesis(),
        DEFAULT_CANONICAL_CONFIG,
      );
      expect(mode).not.toBe("ignore");
    }
  });

  it("audit intents still use confidence-based routing", () => {
    const mode = selectMode(
      makeCls({ intent: "hype_claim" }),
      makeScores({ confidence: 0.1 }),
      makeThesis({ primary: "claim_exceeds_evidence" }),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(mode).toBe("ignore");
  });
});
