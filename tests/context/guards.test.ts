import { describe, it, expect } from "vitest";
import { preLLMGuards, postLLMGuards } from "../../src/context/guards.js";
import type { ContextBundle } from "../../src/context/types.js";

function mockBundle(overrides: Partial<ContextBundle["mention"]> = {}): ContextBundle {
  return {
    mention: {
      tweet_id: "123",
      text: "Hello world",
      author_id: "u1",
      ...overrides,
    },
    thread: {
      root_tweet_id: null,
      chain: [],
      summary: "",
      intent: "unknown",
      tone: "neutral",
      entities: [],
      keywords: [],
      claims: [],
      constraints: [],
    },
    controls: {
      roast_level: "medium",
      deny_reply_mode: "silent",
      activation_mode: "global",
      max_thread_depth: 3,
      enable_timeline_scout: false,
      max_timeline_queries: 2,
    },
    trace: {
      request_id: "req-1",
      started_at: new Date().toISOString(),
      cache_hits: [],
      api_calls: [],
      warnings: [],
    },
  };
}

describe("guards", () => {
  it("passes valid mention", () => {
    const result = preLLMGuards(mockBundle());
    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("blocks empty mention text", () => {
    const result = preLLMGuards(mockBundle({ text: "" }));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("empty_mention");
    expect(result.public_label).toBe("no-content");
  });

  it("blocks whitespace-only mention", () => {
    const result = preLLMGuards(mockBundle({ text: "   \n\t  " }));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("empty_mention");
  });

  it("blocks PII pattern (phone + address keyword)", () => {
    const result = preLLMGuards(mockBundle({ text: "My phone 5551234567 and address" }));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("pii_detected");
    expect(result.public_label).toBe("nope");
  });

  it("passes text with numbers but no PII keywords", () => {
    const result = preLLMGuards(mockBundle({ text: "Price is $123" }));
    expect(result.ok).toBe(true);
  });
});

describe("postLLMGuards", () => {
  it("passes valid reply", () => {
    expect(postLLMGuards("Chart observation complete.").ok).toBe(true);
  });

  it("blocks empty reply", () => {
    const r = postLLMGuards("");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("empty_reply");
  });

  it("blocks reply > 280 chars", () => {
    const r = postLLMGuards("a".repeat(281));
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("reply_too_long");
  });

  it("allows exactly 280 chars", () => {
    expect(postLLMGuards("a".repeat(280)).ok).toBe(true);
  });
});
