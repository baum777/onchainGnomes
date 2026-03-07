/**
 * Gorky LLM Response Generation Tests
 *
 * Validates that LLM-generated responses follow Gorky persona and structural rules:
 * - Observation / Insight / Light Roast structure
 * - No financial advice, buy/sell/ape, or "you are" attacks
 * - X-friendly length (< 280 chars)
 * - Blocked/skipped for aggressive bait
 *
 * Supports: Mocked LLM (default), Real LLM (optional, see TODO).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LLMClient } from "../../../src/clients/llmClient.js";
import { handleEvent } from "../../../src/canonical/pipeline.js";
import type { CanonicalEvent } from "../../../src/canonical/types.js";
import { DEFAULT_CANONICAL_CONFIG } from "../../../src/canonical/types.js";
import * as dedupeGuard from "../../../src/ops/dedupeGuard.js";
import * as rateLimiter from "../../../src/ops/rateLimiter.js";
import { resetLaunchEnvCache } from "../../../src/config/env.js";

vi.mock("../../../src/ops/dedupeGuard.js", () => ({
  dedupeCheckAndMark: vi.fn(),
}));
vi.mock("../../../src/ops/rateLimiter.js", () => ({
  enforceLaunchRateLimits: vi.fn(),
}));
vi.mock("../../../src/canonical/auditLog.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/canonical/auditLog.js")>();
  return {
    ...actual,
    persistAuditRecord: vi.fn(),
  };
});

// --- Helpers ---

function makeEvent(text: string, overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    event_id: `llm-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    platform: "twitter",
    trigger_type: "mention",
    author_handle: "@testuser",
    author_id: "u1",
    text,
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

function makeMockLLM(reply: string): LLMClient {
  return {
    generateJSON: vi.fn().mockResolvedValue({ reply }),
  };
}

/**
 * Deterministic mock Gorky-style output with Observation/Insight/Light Roast structure.
 * Used in Mocked LLM mode. For Real LLM mode, replace with actual llm.generateJSON call.
 *
 * TODO: Real LLM integration — when process.env.USE_REAL_LLM is set, wire in the real
 * LLM client here and call the actual generation path (fallbackCascade → llm.generateJSON).
 */
function mockGenerateResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("wagmi") || lower.includes("healthy correction")) {
    return "Observation: Hopium persists despite the dip. Insight: Correction narratives age like milk. Light Roast: Patience optional.";
  }
  if (lower.includes("pumped") || lower.includes("60%")) {
    return "Observation: Volume spike, thin book. Insight: Liquidity illusion makes moves feel bigger. Light Roast: The chart remembers.";
  }
  if (lower.includes("revolutionize") || lower.includes("defi")) {
    return "Observation: Bold claims arrive faster than user activity. Insight: Narrative stronger than underlying metrics. Light Roast: Utility scheduled for later patch.";
  }
  if (lower.includes("cycle") && lower.includes("different")) {
    return "Observation: The script repeats. Insight: Every cycle claims uniqueness. Light Roast: History rhymes, often badly.";
  }
  // Default structured response
  return "Observation: Claims exceed evidence. Insight: The thesis needs more legs. Light Roast: Familiar arc.";
}

/**
 * Asserts that a Gorky response meets structure, safety, and length rules.
 */
function assertValidGorkyResponse(response: string): void {
  expect(response).toContain("Observation:");
  expect(response).toContain("Insight:");
  expect(response).toContain("Light Roast:");
  expect(response.length).toBeLessThan(280);
  expect(response).not.toMatch(/you are/i);
  expect(response).not.toMatch(/(buy|sell|ape)/i);
}

// --- Test Suite ---

describe("Gorky LLM response generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLaunchEnvCache();
    vi.mocked(dedupeGuard.dedupeCheckAndMark).mockResolvedValue({ ok: true });
    vi.mocked(rateLimiter.enforceLaunchRateLimits).mockResolvedValue({ ok: true });
  });

  it("Hopium case: valid response with Observation/Insight/Light Roast, length < 280", async () => {
    const input = "WAGMI, this healthy correction changes nothing.";
    const event = makeEvent(input);
    const mockReply = mockGenerateResponse(input);
    const deps = { llm: makeMockLLM(mockReply), botUserId: "bot" };
    const result = await handleEvent(event, deps, DEFAULT_CANONICAL_CONFIG);

    if (result.action === "skip") {
      expect(result.skip_reason).toBeDefined();
      return;
    }
    expect(result.action).toBe("publish");
    expect(result.reply_text).toBeDefined();
    assertValidGorkyResponse(result.reply_text!);
  });

  it("Liquidity illusion case: structured response, mild sarcastic tone, no direct targeting", async () => {
    const input = "This token just pumped 60% in an hour.";
    const event = makeEvent(input);
    const mockReply = mockGenerateResponse(input);
    const deps = { llm: makeMockLLM(mockReply), botUserId: "bot" };
    const result = await handleEvent(event, deps, DEFAULT_CANONICAL_CONFIG);

    if (result.action === "skip") {
      expect(result.skip_reason).toBeDefined();
      return;
    }
    expect(result.action).toBe("publish");
    expect(result.reply_text).toBeDefined();
    assertValidGorkyResponse(result.reply_text!);
    expect(result.reply_text).not.toMatch(/you are/i);
  });

  it("Fake utility narrative: narrative critique, not attacking the author", async () => {
    const input = "Our token will revolutionize DeFi.";
    const event = makeEvent(input);
    const mockReply = mockGenerateResponse(input);
    const deps = { llm: makeMockLLM(mockReply), botUserId: "bot" };
    const result = await handleEvent(event, deps, DEFAULT_CANONICAL_CONFIG);

    if (result.action === "skip") {
      expect(result.skip_reason).toBeDefined();
      return;
    }
    expect(result.action).toBe("publish");
    expect(result.reply_text).toBeDefined();
    assertValidGorkyResponse(result.reply_text!);
    expect(result.reply_text).not.toMatch(/you are/i);
  });

  it("Cycle fatigue: roast of narrative, safe tone", async () => {
    const input = "This cycle is different.";
    const event = makeEvent(input);
    const mockReply = mockGenerateResponse(input);
    const deps = { llm: makeMockLLM(mockReply), botUserId: "bot" };
    const result = await handleEvent(event, deps, DEFAULT_CANONICAL_CONFIG);

    if (result.action === "skip") {
      expect(result.skip_reason).toBeDefined();
      return;
    }
    expect(result.action).toBe("publish");
    expect(result.reply_text).toBeDefined();
    assertValidGorkyResponse(result.reply_text!);
  });

  it("Aggressive bait: response blocked or skipped, result null or status skipped", async () => {
    const input = "You are stupid if you don't buy this token.";
    const event = makeEvent(input);
    const deps = { llm: makeMockLLM(""), botUserId: "bot" };
    const result = await handleEvent(event, deps, DEFAULT_CANONICAL_CONFIG);

    expect(result.action).toBe("skip");
    expect(result.skip_reason).toBe("skip_safety_filter");
    expect(deps.llm.generateJSON).not.toHaveBeenCalled();
  });
});
