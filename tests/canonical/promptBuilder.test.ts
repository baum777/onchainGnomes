import { describe, it, expect } from "vitest";
import { buildPrompt, promptToLLMInput } from "../../src/canonical/promptBuilder.js";
import { DEFAULT_CANONICAL_CONFIG } from "../../src/canonical/types.js";
import type { CanonicalEvent, ThesisBundle, ScoreBundle } from "../../src/canonical/types.js";

function makeEvent(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    event_id: "test_1",
    platform: "twitter",
    trigger_type: "mention",
    author_handle: "@testuser",
    author_id: "user_1",
    text: "$SOL mooning 100x gem guaranteed",
    parent_text: null,
    quoted_text: null,
    conversation_context: [],
    cashtags: ["$SOL"],
    hashtags: [],
    urls: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeThesis(): ThesisBundle {
  return {
    primary: "claim_exceeds_evidence",
    supporting_point: "no concrete product proof",
    evidence_bullets: ["contains strong hype language", "no product proof"],
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

describe("promptBuilder", () => {
  it("builds a prompt contract with correct fields", () => {
    const prompt = buildPrompt(
      makeEvent(),
      "analyst_meme_lite",
      makeThesis(),
      makeScores(),
      DEFAULT_CANONICAL_CONFIG,
    );

    expect(prompt.persona).toBe(DEFAULT_CANONICAL_CONFIG.persona_name);
    expect(prompt.mode).toBe("analyst_meme_lite");
    expect(prompt.thesis).toBe("claim_exceeds_evidence");
    expect(prompt.supporting_point).toBe("no concrete product proof");
    expect(prompt.char_budget).toBe(240);
    expect(prompt.confidence_stance).toBe("medium");
    expect(prompt.rules.length).toBeGreaterThan(0);
    expect(prompt.target_text).toContain("$SOL");
  });

  it("derives high confidence stance for confidence >= 0.75", () => {
    const prompt = buildPrompt(
      makeEvent(),
      "hard_caution",
      makeThesis(),
      makeScores({ confidence: 0.8 }),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(prompt.confidence_stance).toBe("high");
  });

  it("derives low confidence stance for confidence < 0.5", () => {
    const prompt = buildPrompt(
      makeEvent(),
      "soft_deflection",
      makeThesis(),
      makeScores({ confidence: 0.3 }),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(prompt.confidence_stance).toBe("low");
  });

  it("converts prompt to LLM input format", () => {
    const prompt = buildPrompt(
      makeEvent(),
      "dry_one_liner",
      makeThesis(),
      makeScores(),
      DEFAULT_CANONICAL_CONFIG,
    );
    const llmInput = promptToLLMInput(prompt);

    expect(llmInput.system).toContain(DEFAULT_CANONICAL_CONFIG.persona_name);
    expect(llmInput.system).toContain("dry_one_liner");
    expect(llmInput.system).toContain("claim_exceeds_evidence");
    expect(llmInput.developer).toContain("JSON");
    expect(llmInput.user).toContain("$SOL");
  });

  it("includes parent text in LLM user input when present", () => {
    const prompt = buildPrompt(
      makeEvent({ parent_text: "Original hype tweet here" }),
      "skeptical_breakdown",
      makeThesis(),
      makeScores(),
      DEFAULT_CANONICAL_CONFIG,
    );
    const llmInput = promptToLLMInput(prompt);
    expect(llmInput.user).toContain("Original hype tweet here");
  });
});
