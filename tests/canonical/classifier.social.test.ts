import { describe, it, expect } from "vitest";
import { classify } from "../../src/canonical/classifier.js";
import type { CanonicalEvent } from "../../src/canonical/types.js";

function makeEvent(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    event_id: "test_social_1",
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

describe("classifier — social intents", () => {
  it('classifies "hey" as greeting', () => {
    const result = classify(makeEvent({ text: "hey" }));
    expect(result.intent).toBe("greeting");
    expect(result.policy_blocked).toBe(false);
    expect(result.policy_severity).toBe("soft");
  });

  it('classifies "gm" as greeting', () => {
    const result = classify(makeEvent({ text: "gm" }));
    expect(result.intent).toBe("greeting");
  });

  it('classifies "hi!" as greeting', () => {
    const result = classify(makeEvent({ text: "hi!" }));
    expect(result.intent).toBe("greeting");
  });

  it('classifies "yo" as greeting', () => {
    const result = classify(makeEvent({ text: "yo" }));
    expect(result.intent).toBe("greeting");
  });

  it('classifies "sup?" as greeting', () => {
    const result = classify(makeEvent({ text: "sup?" }));
    expect(result.intent).toBe("greeting");
  });

  it('classifies "good morning" as greeting', () => {
    const result = classify(makeEvent({ text: "good morning" }));
    expect(result.intent).toBe("greeting");
  });

  it('classifies altseason question as market_question_general', () => {
    const result = classify(makeEvent({ text: "is there an altseason on the horizon?" }));
    expect(result.intent).toBe("market_question_general");
    expect(result.policy_blocked).toBe(false);
  });

  it('classifies "do you think sol runs again?" as market_question_general', () => {
    const result = classify(makeEvent({ text: "do you think sol runs again?" }));
    expect(result.intent).toBe("market_question_general");
  });

  it('classifies "market cooked or not?" as market_question_general', () => {
    const result = classify(makeEvent({ text: "market cooked or not?" }));
    expect(result.intent).toBe("market_question_general");
  });

  it('classifies "who are you?" as persona_query', () => {
    const result = classify(makeEvent({ text: "who are you?" }));
    expect(result.intent).toBe("persona_query");
    expect(result.target).toBe("persona");
  });

  it('classifies "what\'s your deal?" as persona_query', () => {
    const result = classify(makeEvent({ text: "what's your deal?" }));
    expect(result.intent).toBe("persona_query");
  });

  it('classifies "tell me your lore" as lore_query', () => {
    const result = classify(makeEvent({ text: "tell me your lore" }));
    expect(result.intent).toBe("lore_query");
    expect(result.target).toBe("lore");
  });

  it('classifies "where are you from" as lore_query', () => {
    const result = classify(makeEvent({ text: "where are you from" }));
    expect(result.intent).toBe("lore_query");
  });

  it('classifies "thoughts?" as casual_ping', () => {
    const result = classify(makeEvent({ text: "thoughts?" }));
    expect(result.intent).toBe("casual_ping");
  });

  it('classifies "what we saying?" as casual_ping', () => {
    const result = classify(makeEvent({ text: "what we saying?" }));
    expect(result.intent).toBe("casual_ping");
  });

  it("greeting target is conversation", () => {
    const result = classify(makeEvent({ text: "hey" }));
    expect(result.target).toBe("conversation");
  });

  it("greeting evidence is absent", () => {
    const result = classify(makeEvent({ text: "hey" }));
    expect(result.evidence_class).toBe("absent");
  });

  it("spam still overrides social patterns", () => {
    const result = classify(makeEvent({ text: "gm! DM me for free airdrop click link" }));
    expect(result.intent).toBe("spam");
    expect(result.policy_blocked).toBe(true);
    expect(result.policy_severity).toBe("hard");
  });

  it("bait still overrides social patterns", () => {
    const result = classify(makeEvent({ text: "hey bet you can't prove me wrong coward" }));
    expect(result.intent).toBe("bait");
  });
});
