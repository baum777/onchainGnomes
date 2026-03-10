import { describe, it, expect, vi } from "vitest";
import { fallbackCascade } from "../../src/canonical/fallbackCascade.js";
import { DEFAULT_CANONICAL_CONFIG } from "../../src/canonical/types.js";
import type {
  CanonicalEvent,
  ClassifierOutput,
  ScoreBundle,
  ThesisBundle,
} from "../../src/canonical/types.js";
import type { LLMClient } from "../../src/clients/llmClient.js";

function makeEvent(): CanonicalEvent {
  return {
    event_id: "test_1",
    platform: "twitter",
    trigger_type: "mention",
    author_handle: "@testuser",
    author_id: "user_1",
    text: "$SOL mooning 100x gem",
    parent_text: null,
    quoted_text: null,
    conversation_context: [],
    cashtags: ["$SOL"],
    hashtags: [],
    urls: [],
    timestamp: new Date().toISOString(),
  };
}

function makeCls(): ClassifierOutput {
  return {
    intent: "hype_claim",
    target: "claim",
    evidence_class: "contextual_medium",
    bait_probability: 0.1,
    spam_probability: 0.05,
    policy_blocked: false,
    evidence_bullets: ["contains strong hype language"],
    risk_flags: [],
  };
}

function makeScores(): ScoreBundle {
  return {
    relevance: 0.7,
    confidence: 0.6,
    severity: 0.5,
    opportunity: 0.6,
    risk: 0.2,
    novelty: 0.7,
  };
}

function makeThesis(): ThesisBundle {
  return {
    primary: "claim_exceeds_evidence",
    supporting_point: null,
    evidence_bullets: ["hype language"],
  };
}

function createMockLLM(replies: string[]): LLMClient {
  let callIndex = 0;
  return {
    generateJSON: vi.fn(async () => {
      const reply = replies[callIndex] ?? replies[replies.length - 1];
      callIndex++;
      return { reply };
    }),
  };
}

const configNoRefine = { ...DEFAULT_CANONICAL_CONFIG, refine_enabled: false };

describe("fallbackCascade", () => {
  it("succeeds on first attempt with valid reply", async () => {
    const llm = createMockLLM(["Nice hype, zero proof."]);
    const result = await fallbackCascade(
      llm,
      makeEvent(),
      "dry_one_liner",
      makeThesis(),
      makeScores(),
      makeCls(),
      configNoRefine,
    );
    expect(result.success).toBe(true);
    expect(result.reply_text).toBe("Nice hype, zero proof.");
    expect(result.final_mode).toBe("dry_one_liner");
    expect(result.attempts).toBe(1);
  });

  it("triggers refine when first reply is too short and returns refined reply", async () => {
    const llm = createMockLLM([
      "Short.", // too short, triggers refine
      "Your concentrated nothing-burger launch with sloppy liquidity and inorganic volume? Cope.",
    ]);
    const event = makeEvent();
    event.text = "We have concentrated liquidity and nothing sloppy";
    const result = await fallbackCascade(
      llm,
      event,
      "dry_one_liner",
      makeThesis(),
      makeScores(),
      makeCls(),
      { ...DEFAULT_CANONICAL_CONFIG, refine_enabled: true },
    );
    expect(result.success).toBe(true);
    expect(result.reply_text).toBe("Your concentrated nothing-burger launch with sloppy liquidity and inorganic volume? Cope.");
    expect(result.attempts).toBe(2);
  });

  it("skips refine when first reply is long enough and has keywords", async () => {
    const longReply = "Your concentrated nothing-burger with sloppy liquidity and inorganic volume screams paper hands. Cope.";
    const llm = createMockLLM([longReply]);
    const event = makeEvent();
    event.text = "concentrated sloppy inorganic volume";
    const result = await fallbackCascade(
      llm,
      event,
      "dry_one_liner",
      makeThesis(),
      makeScores(),
      makeCls(),
      { ...DEFAULT_CANONICAL_CONFIG, refine_enabled: true },
    );
    expect(result.success).toBe(true);
    expect(result.reply_text).toBe(longReply);
    expect(result.attempts).toBe(1);
  });

  it("retries and succeeds on second attempt", async () => {
    const llm = createMockLLM([
      "You should buy this now, guaranteed profit!",
      "All hype, no proof.",
    ]);
    const result = await fallbackCascade(
      llm,
      makeEvent(),
      "dry_one_liner",
      makeThesis(),
      makeScores(),
      makeCls(),
      configNoRefine,
    );
    expect(result.success).toBe(true);
    expect(result.reply_text).toBe("All hype, no proof.");
    expect(result.attempts).toBe(2);
  });

  it("downgrades mode and succeeds", async () => {
    const llm = createMockLLM([
      "You should buy this now, guaranteed profit!",
      "You should buy this now, guaranteed profit!",
      "Meh.",
    ]);
    const result = await fallbackCascade(
      llm,
      makeEvent(),
      "dry_one_liner",
      makeThesis(),
      makeScores(),
      makeCls(),
      configNoRefine,
    );
    expect(result.success).toBe(true);
    expect(result.final_mode).toBe("soft_deflection");
    expect(result.attempts).toBe(3);
  });

  it("skips after all fallback attempts fail", async () => {
    const badReply = "You should buy this now, guaranteed profit!";
    const llm = createMockLLM([badReply, badReply, badReply]);
    const result = await fallbackCascade(
      llm,
      makeEvent(),
      "soft_deflection",
      makeThesis(),
      makeScores(),
      makeCls(),
      configNoRefine,
    );
    expect(result.success).toBe(false);
    expect(result.reply_text).toBeNull();
  });
});
