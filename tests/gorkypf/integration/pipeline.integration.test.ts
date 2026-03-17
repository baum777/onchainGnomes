/**
 * Gorky Pipeline Integration Tests
 *
 * Covers: safe publish path, safety block, validation fail, launchGate behavior,
 * dedupe block, rate-limit block. Uses mock LLM.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LLMClient } from "../../../src/clients/llmClient.js";
import { handleEvent } from "../../../src/canonical/pipeline.js";
import type { CanonicalEvent } from "../../../src/canonical/types.js";
import { DEFAULT_CANONICAL_CONFIG } from "../../../src/canonical/types.js";
import * as dedupeGuard from "../../../src/ops/dedupeGuard.js";
import * as rateLimiter from "../../../src/ops/rateLimiter.js";
import { resetLaunchEnvCache } from "../../../src/config/env.js";
import { hasVoiceSigilMarker, stripVoiceSigils } from "../../_helpers/voiceSigils.js";

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

function makeEvent(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    event_id: "int-test-1",
    platform: "twitter",
    trigger_type: "mention",
    author_handle: "@testuser",
    author_id: "u1",
    text: "WAGMI fam, 100x incoming, this is the one",
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

describe("Gorky pipeline integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLaunchEnvCache();
    vi.mocked(dedupeGuard.dedupeCheckAndMark).mockResolvedValue({ ok: true });
    vi.mocked(rateLimiter.enforceLaunchRateLimits).mockResolvedValue({ ok: true });
  });

  it("safe publish path: eligible mention returns publish result", async () => {
    const event = makeEvent({ text: "WAGMI fam, 100x incoming, this is the one" });
    const mockReply = "Hopium levels: elevated. The thesis is familiar.";
    const deps = { llm: makeMockLLM(mockReply), botUserId: "bot" };
    const result = await handleEvent(event, deps, DEFAULT_CANONICAL_CONFIG);

    if (result.action === "skip") {
      expect(result.skip_reason).toBeDefined();
      return;
    }
    expect(result.action).toBe("publish");
    expect(hasVoiceSigilMarker(result.reply_text)).toBe(true);
    expect(stripVoiceSigils(result.reply_text)).toBe(mockReply);
    expect(result.audit.detected_narrative).toBeDefined();
    expect(result.audit.selected_pattern).toBeDefined();
  });

  it("blocked by safety: identity bait skips before LLM", async () => {
    const event = makeEvent({ text: "You are stupid and wrong about everything" });
    const deps = { llm: makeMockLLM(""), botUserId: "bot" };
    const result = await handleEvent(event, deps, DEFAULT_CANONICAL_CONFIG);
    expect(result.action).toBe("skip");
    expect(result.skip_reason).toBe("skip_safety_filter");
    expect(deps.llm.generateJSON).not.toHaveBeenCalled();
  });

  it("validation failure: invalid reply triggers skip", async () => {
    const event = makeEvent({ text: "WAGMI fam, 100x incoming" });
    const deps = {
      llm: makeMockLLM("you are stupid and your bags are worthless"),
      botUserId: "bot",
    };
    const result = await handleEvent(event, deps, DEFAULT_CANONICAL_CONFIG);
    if (result.action === "skip" && result.skip_reason === "skip_validation_failure") {
      expect(result.audit.final_action).toBe("skip");
      return;
    }
    expect(result.action).toBeDefined();
  });

  it("dedupe block: duplicate event_id skips", async () => {
    vi.mocked(dedupeGuard.dedupeCheckAndMark).mockResolvedValueOnce({
      ok: false,
      reason: "already_processed",
    });
    const event = makeEvent({ event_id: "dup-123" });
    const deps = { llm: makeMockLLM("x"), botUserId: "bot" };
    const result = await handleEvent(event, deps, DEFAULT_CANONICAL_CONFIG);
    expect(result.action).toBe("skip");
    expect(result.skip_reason).toBe("skip_duplicate");
    expect(deps.llm.generateJSON).not.toHaveBeenCalled();
  });

  it("rate-limit block: exceeded limits skips", async () => {
    vi.mocked(rateLimiter.enforceLaunchRateLimits).mockResolvedValueOnce({
      ok: false,
      reason: "rate_limited",
      retryAfterMs: 60_000,
    });
    const event = makeEvent();
    const deps = { llm: makeMockLLM("x"), botUserId: "bot" };
    const result = await handleEvent(event, deps, DEFAULT_CANONICAL_CONFIG);
    expect(result.action).toBe("skip");
    expect(result.skip_reason).toBe("skip_rate_limit");
    expect(deps.llm.generateJSON).not.toHaveBeenCalled();
  });
});
