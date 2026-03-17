import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleEvent, type PipelineDeps } from "../../src/canonical/pipeline.js";
import { DEFAULT_CANONICAL_CONFIG } from "../../src/canonical/types.js";
import type { CanonicalEvent } from "../../src/canonical/types.js";
import type { LLMClient } from "../../src/clients/llmClient.js";
import { cacheClear } from "../../src/ops/memoryCache.js";
import fs from "node:fs";
import path from "node:path";
import { hasVoiceSigilMarker, stripVoiceSigils } from "../_helpers/voiceSigils.js";

const AUDIT_FILE = path.join(process.cwd(), "data", "audit_log.jsonl");

function makeEvent(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    event_id: `int_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    platform: "twitter",
    trigger_type: "mention",
    author_handle: "@testuser",
    author_id: "user_1",
    text: "$SOL mooning 100x gem guaranteed easy money LFG",
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

function createMockLLM(reply = "Zero proof, pure noise."): LLMClient {
  return {
    generateJSON: vi.fn(async () => ({ reply })),
  };
}

function makeDeps(reply?: string): PipelineDeps {
  return {
    llm: createMockLLM(reply),
    botUserId: "bot_999",
  };
}

describe("pipeline integration", () => {
  beforeEach(async () => {
    await cacheClear();
    if (fs.existsSync(AUDIT_FILE)) fs.unlinkSync(AUDIT_FILE);
  });
  afterEach(() => {
    if (fs.existsSync(AUDIT_FILE)) fs.unlinkSync(AUDIT_FILE);
  });

  it("publishes a valid reply for a hype mention", async () => {
    const result = await handleEvent(makeEvent(), makeDeps(), DEFAULT_CANONICAL_CONFIG);
    expect(result.action).toBe("publish");
    if (result.action === "publish") {
      expect(hasVoiceSigilMarker(result.reply_text)).toBe(true);
      expect(stripVoiceSigils(result.reply_text)).toBe("Zero proof, pure noise.");
      expect(result.thesis.primary).toBeTruthy();
      expect(["dry_one_liner", "analyst_meme_lite", "skeptical_breakdown", "soft_deflection"]).toContain(result.mode);
      expect(result.audit.final_action).toBe("publish");
    }
  });

  it("creates an audit record on publish", async () => {
    const result = await handleEvent(makeEvent(), makeDeps(), DEFAULT_CANONICAL_CONFIG);
    expect(result.action).toBe("publish");
    expect(result.audit).toBeTruthy();
    expect(result.audit.final_action).toBe("publish");
    expect(result.audit.reply_hash).toBeTruthy();
  });

  it("creates an audit record on skip", async () => {
    const event = makeEvent({ text: "nice weather today" });
    const result = await handleEvent(event, makeDeps(), DEFAULT_CANONICAL_CONFIG);
    expect(result.action).toBe("skip");
    expect(result.audit).toBeTruthy();
    expect(result.audit.final_action).toBe("skip");
  });
});
