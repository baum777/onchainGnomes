import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleEvent, type PipelineDeps } from "../../src/canonical/pipeline.js";
import { DEFAULT_CANONICAL_CONFIG } from "../../src/canonical/types.js";
import type { CanonicalEvent, CanonicalConfig } from "../../src/canonical/types.js";
import type { LLMClient } from "../../src/clients/llmClient.js";
import { hasVoiceSigilMarker, stripVoiceSigils } from "../_helpers/voiceSigils.js";
import { cacheClear } from "../../src/ops/memoryCache.js";
import fs from "node:fs";
import path from "node:path";

const AUDIT_FILE = path.join(process.cwd(), "data", "audit_log.jsonl");

let eventCounter = 0;
function makeEvent(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  eventCounter++;
  return {
    event_id: `fb_${eventCounter}_${Date.now()}`,
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

function createFailThenSucceedLLM(failCount: number, goodReply: string): LLMClient {
  let calls = 0;
  return {
    generateJSON: vi.fn(async () => {
      calls++;
      if (calls <= failCount) {
        return { reply: "You should buy this now, guaranteed profit!" };
      }
      return { reply: goodReply };
    }),
  };
}

function makeDeps(llm: LLMClient): PipelineDeps {
  return {
    llm,
    botUserId: "bot_999",
  };
}

describe("pipeline fallback scenarios", () => {
  beforeEach(async () => {
    await cacheClear();
    if (fs.existsSync(AUDIT_FILE)) fs.unlinkSync(AUDIT_FILE);
  });
  afterEach(() => {
    if (fs.existsSync(AUDIT_FILE)) fs.unlinkSync(AUDIT_FILE);
  });

  it("publishes after first generation fails and retry succeeds", async () => {
    const llm = createFailThenSucceedLLM(1, "Hype check: zero substance.");
    const result = await handleEvent(makeEvent(), makeDeps(llm), DEFAULT_CANONICAL_CONFIG);
    expect(result.action).toBe("publish");
    if (result.action === "publish") {
      expect(hasVoiceSigilMarker(result.reply_text)).toBe(true);
      expect(stripVoiceSigils(result.reply_text)).toBe("Hype check: zero substance.");
    }
  });

  it("downgrades mode when both initial attempts fail", async () => {
    const llm = createFailThenSucceedLLM(2, "Meh.");
    const result = await handleEvent(makeEvent(), makeDeps(llm), DEFAULT_CANONICAL_CONFIG);
    expect(result.action).toBe("publish");
    if (result.action === "publish") {
      expect(hasVoiceSigilMarker(result.reply_text)).toBe(true);
      expect(stripVoiceSigils(result.reply_text)).toBe("Meh.");
    }
  });

  it("skips when all fallback attempts fail", async () => {
    const badReply = "You should buy this now, guaranteed profit!";
    const llm: LLMClient = {
      generateJSON: vi.fn(async () => ({ reply: badReply })),
    };
    const result = await handleEvent(makeEvent(), makeDeps(llm), DEFAULT_CANONICAL_CONFIG);
    expect(result.action).toBe("skip");
    if (result.action === "skip") {
      expect(result.skip_reason).toBe("skip_validation_failure");
    }
  });
});
