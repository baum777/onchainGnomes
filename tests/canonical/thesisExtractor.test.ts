import { describe, it, expect } from "vitest";
import { extractThesis } from "../../src/canonical/thesisExtractor.js";
import type { CanonicalEvent, ClassifierOutput, ScoreBundle } from "../../src/canonical/types.js";

function makeEvent(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    event_id: "test_1",
    platform: "twitter",
    trigger_type: "mention",
    author_handle: "@testuser",
    author_id: "user_1",
    text: "Hello world",
    parent_text: null,
    quoted_text: null,
    conversation_context: [],
    cashtags: [],
    hashtags: [],
    urls: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeCls(overrides: Partial<ClassifierOutput> = {}): ClassifierOutput {
  return {
    intent: "hype_claim",
    target: "claim",
    evidence_class: "weak_speculative",
    bait_probability: 0.1,
    spam_probability: 0.05,
    policy_blocked: false,
    evidence_bullets: ["contains strong hype language", "no concrete product proof"],
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

describe("thesisExtractor", () => {
  it("extracts empty_hype_no_substance for moon talk without proof", () => {
    const event = makeEvent({ text: "$SOL going to the moon! 100x gem LFG guaranteed" });
    const result = extractThesis(event, makeCls(), makeScores());
    expect(result).not.toBeNull();
    expect(result!.primary).toBe("empty_hype_no_substance");
  });

  it("extracts claim_exceeds_evidence for performance claims without proof", () => {
    const event = makeEvent({ text: "This coin did 500% gain, breaking out, ATH soon" });
    const cls = makeCls({ intent: "performance_claim" });
    const result = extractThesis(event, cls, makeScores());
    expect(result).not.toBeNull();
    expect(result!.primary).toBe("claim_exceeds_evidence");
  });

  it("extracts suspicious_behavior_pattern for wash trading mentions", () => {
    const event = makeEvent({ text: "Clearly wash trading with bot volume and same wallet" });
    const result = extractThesis(event, makeCls({ intent: "accusation" }), makeScores());
    expect(result).not.toBeNull();
    expect(result!.primary).toBe("suspicious_behavior_pattern");
  });

  it("extracts obvious_bait for bait language", () => {
    const event = makeEvent({ text: "Bet you can't prove me wrong, coward" });
    const cls = makeCls({ intent: "bait", bait_probability: 0.7 });
    const result = extractThesis(event, cls, makeScores());
    expect(result).not.toBeNull();
    expect(result!.primary).toBe("obvious_bait");
    expect(result!.supporting_point).toBeNull();
  });

  it("extracts narrative_stronger_than_product for narrative without proof", () => {
    const event = makeEvent({ text: "The narrative is strong, cycle rotation, trending meta" });
    const result = extractThesis(event, makeCls(), makeScores());
    expect(result).not.toBeNull();
    expect(result!.primary).toBe("narrative_stronger_than_product");
  });

  it("extracts factual_correction_only for corrective question", () => {
    const event = makeEvent({
      text: "Actually that's incorrect, the project has a verified smart contract",
    });
    const cls = makeCls({
      intent: "question",
      evidence_class: "self_contained_strong",
    });
    const result = extractThesis(event, cls, makeScores());
    expect(result).not.toBeNull();
    expect(result!.primary).toBe("factual_correction_only");
  });

  it("includes supporting point from evidence bullets", () => {
    const event = makeEvent({ text: "$SOL mooning 100x gem" });
    const cls = makeCls({
      evidence_bullets: ["contains strong hype language", "no concrete product proof"],
    });
    const result = extractThesis(event, cls, makeScores());
    expect(result).not.toBeNull();
    expect(result!.supporting_point).toBe("no concrete product proof");
    expect(result!.evidence_bullets.length).toBeLessThanOrEqual(2);
  });
});
