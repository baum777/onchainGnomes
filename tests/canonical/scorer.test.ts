import { describe, it, expect } from "vitest";
import { scoreEvent } from "../../src/canonical/scorer.js";
import type { CanonicalEvent, ClassifierOutput } from "../../src/canonical/types.js";

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

function makeClassifier(overrides: Partial<ClassifierOutput> = {}): ClassifierOutput {
  return {
    intent: "hype_claim",
    target: "claim",
    evidence_class: "contextual_medium",
    bait_probability: 0.1,
    spam_probability: 0.05,
    policy_blocked: false,
    evidence_bullets: ["contains strong hype language"],
    risk_flags: [],
    ...overrides,
  };
}

describe("scorer", () => {
  it("produces all 6 dimensions in [0,1]", () => {
    const event = makeEvent();
    const cls = makeClassifier();
    const scores = scoreEvent(event, cls);

    expect(scores.relevance).toBeGreaterThanOrEqual(0);
    expect(scores.relevance).toBeLessThanOrEqual(1);
    expect(scores.confidence).toBeGreaterThanOrEqual(0);
    expect(scores.confidence).toBeLessThanOrEqual(1);
    expect(scores.severity).toBeGreaterThanOrEqual(0);
    expect(scores.severity).toBeLessThanOrEqual(1);
    expect(scores.opportunity).toBeGreaterThanOrEqual(0);
    expect(scores.opportunity).toBeLessThanOrEqual(1);
    expect(scores.risk).toBeGreaterThanOrEqual(0);
    expect(scores.risk).toBeLessThanOrEqual(1);
    expect(scores.novelty).toBeGreaterThanOrEqual(0);
    expect(scores.novelty).toBeLessThanOrEqual(1);
  });

  it("scores hype claims with higher relevance", () => {
    const event = makeEvent({ cashtags: ["$SOL"] });
    const cls = makeClassifier({ intent: "hype_claim" });
    const scores = scoreEvent(event, cls);
    expect(scores.relevance).toBeGreaterThan(0.5);
  });

  it("scores spam with low relevance", () => {
    const event = makeEvent();
    const cls = makeClassifier({ intent: "spam", spam_probability: 0.8 });
    const scores = scoreEvent(event, cls);
    expect(scores.relevance).toBeLessThan(0.3);
  });

  it("scores accusations with high severity", () => {
    const event = makeEvent();
    const cls = makeClassifier({
      intent: "accusation",
      risk_flags: ["suspicious_behavior_signals"],
    });
    const scores = scoreEvent(event, cls);
    expect(scores.severity).toBeGreaterThan(0.6);
  });

  it("increases risk for bait + aggressive input", () => {
    const event = makeEvent();
    const cls = makeClassifier({
      intent: "bait",
      bait_probability: 0.8,
      risk_flags: ["aggressive_input", "bait_detected"],
    });
    const scores = scoreEvent(event, cls);
    expect(scores.risk).toBeGreaterThan(0.4);
  });

  it("increases confidence with strong evidence", () => {
    const event = makeEvent({ parent_text: "some parent context" });
    const cls = makeClassifier({
      evidence_class: "self_contained_strong",
      evidence_bullets: ["a", "b", "c"],
    });
    const scores = scoreEvent(event, cls);
    expect(scores.confidence).toBeGreaterThan(0.7);
  });
});
