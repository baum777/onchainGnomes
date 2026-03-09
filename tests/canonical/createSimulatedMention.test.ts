import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createSimulatedMention,
  resetSimulatedMentionCounter,
} from "../../src/canonical/createSimulatedMention.js";
import { handleEvent, type PipelineDeps } from "../../src/canonical/pipeline.js";
import { DEFAULT_CANONICAL_CONFIG } from "../../src/canonical/types.js";
import type { CanonicalEvent } from "../../src/canonical/types.js";
import type { LLMClient } from "../../src/clients/llmClient.js";
import { cacheClear } from "../../src/ops/memoryCache.js";
import fs from "node:fs";
import path from "node:path";

const AUDIT_FILE = path.join(process.cwd(), "data", "audit_log.jsonl");

function createMockLLM(reply = "Simulated pipeline reply."): LLMClient {
  return { generateJSON: vi.fn(async () => ({ reply })) };
}

describe("createSimulatedMention", () => {
  beforeEach(() => {
    resetSimulatedMentionCounter();
  });

  it("creates valid simulated mention event from plain text", () => {
    const event = createSimulatedMention("What do you think about $SOL?");
    expect(event).toMatchObject({
      platform: "twitter",
      trigger_type: "mention",
      author_handle: "@terminal_user",
      author_id: "terminal-user-1",
      parent_text: null,
      quoted_text: null,
      conversation_context: [],
    });
    expect(event.event_id).toMatch(/^terminal-mention-\d{4}$/);
    expect(event.text).toContain("What do you think about $SOL?");
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(event.cashtags).toContain("SOL");
  });

  it("auto-prefixes @Gorky_on_sol when missing", () => {
    const event = createSimulatedMention("Denkst du der Meta-Trend dreht sich?");
    expect(event.text).toMatch(/^@\w+\s+Denkst du der Meta-Trend/);
    expect(event.text).toContain("Denkst du der Meta-Trend dreht sich?");
  });

  it("preserves input if @Gorky_on_sol already present", () => {
    const event = createSimulatedMention("@Gorky_on_sol What about altseason?");
    expect(event.text).toContain("@Gorky_on_sol");
    expect(event.text).toContain("What about altseason?");
  });

  it("extracts cashtags, hashtags, urls", () => {
    const event = createSimulatedMention(
      "@Gorky_on_sol Check $PEPE and #memecoins https://example.com"
    );
    expect(event.cashtags).toContain("PEPE");
    expect(event.hashtags).toContain("memecoins");
    expect(event.urls).toContain("https://example.com");
  });

  it("throws on empty input", () => {
    expect(() => createSimulatedMention("")).toThrow();
    expect(() => createSimulatedMention("   ")).toThrow();
  });

  it("increments event_id counter", () => {
    const e1 = createSimulatedMention("first");
    const e2 = createSimulatedMention("second");
    expect(e1.event_id).toBe("terminal-mention-0001");
    expect(e2.event_id).toBe("terminal-mention-0002");
  });

  it("produces CanonicalEvent-compatible shape", () => {
    const event = createSimulatedMention("hello") as CanonicalEvent;
    const required: (keyof CanonicalEvent)[] = [
      "event_id",
      "platform",
      "trigger_type",
      "author_handle",
      "author_id",
      "text",
      "parent_text",
      "quoted_text",
      "conversation_context",
      "cashtags",
      "hashtags",
      "urls",
      "timestamp",
    ];
    for (const key of required) {
      expect(event).toHaveProperty(key);
    }
    expect(event.platform).toBe("twitter");
    expect(event.trigger_type).toBe("mention");
  });
});

describe("createSimulatedMention pipeline integration", () => {
  beforeEach(async () => {
    resetSimulatedMentionCounter();
    await cacheClear();
    if (fs.existsSync(AUDIT_FILE)) fs.unlinkSync(AUDIT_FILE);
  });

  it("passes simulated mention into canonical pipeline without bridge_error", async () => {
    const event = createSimulatedMention("$SOL mooning 100x gem LFG");
    const mockLLM = createMockLLM("Zero proof, pure noise.");
    const deps: PipelineDeps = { llm: mockLLM, botUserId: "terminal-bot-1" };
    const result = await handleEvent(event, deps, DEFAULT_CANONICAL_CONFIG);
    expect(["publish", "skip"]).toContain(result.action);
    if (result.action === "skip") {
      expect(result.skip_reason).not.toBe("skip_invalid_input");
      expect(result.skip_reason).toMatch(/^skip_/);
    }
  });
});
