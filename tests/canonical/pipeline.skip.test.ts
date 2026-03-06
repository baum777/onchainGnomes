import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleEvent, type PipelineDeps } from "../../src/canonical/pipeline.js";
import { DEFAULT_CANONICAL_CONFIG } from "../../src/canonical/types.js";
import type { CanonicalEvent } from "../../src/canonical/types.js";
import type { LLMClient } from "../../src/clients/llmClient.js";
import { kvClear } from "../../src/ops/kvLite.js";
import fs from "node:fs";
import path from "node:path";

const AUDIT_FILE = path.join(process.cwd(), "data", "audit_log.jsonl");

let eventCounter = 0;
function makeEvent(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  eventCounter++;
  return {
    event_id: `skip_${eventCounter}_${Date.now()}`,
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

function createMockLLM(): LLMClient {
  return {
    generateJSON: vi.fn(async () => ({ reply: "Some reply." })),
  };
}

function makeDeps(): PipelineDeps {
  return {
    llm: createMockLLM(),
    botUserId: "bot_999",
  };
}

describe("pipeline skip scenarios", () => {
  beforeEach(async () => {
    await kvClear();
    if (fs.existsSync(AUDIT_FILE)) fs.unlinkSync(AUDIT_FILE);
  });
  afterEach(() => {
    if (fs.existsSync(AUDIT_FILE)) fs.unlinkSync(AUDIT_FILE);
  });

  it("skips invalid input (empty text)", async () => {
    const result = await handleEvent(
      makeEvent({ text: "" }),
      makeDeps(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.action).toBe("skip");
    if (result.action === "skip") {
      expect(result.skip_reason).toBe("skip_invalid_input");
    }
  });

  it("skips invalid input (missing author_id)", async () => {
    const result = await handleEvent(
      makeEvent({ author_id: "" }),
      makeDeps(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.action).toBe("skip");
    if (result.action === "skip") {
      expect(result.skip_reason).toBe("skip_invalid_input");
    }
  });

  it("skips self-loop", async () => {
    const result = await handleEvent(
      makeEvent({ author_id: "bot_999", text: "$SOL mooning 100x" }),
      makeDeps(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.action).toBe("skip");
    if (result.action === "skip") {
      expect(result.skip_reason).toBe("skip_self_loop");
    }
  });

  it("skips policy-blocked content (spam)", async () => {
    const result = await handleEvent(
      makeEvent({ text: "DM me for free airdrop click link join now! giveaway giveaway" }),
      makeDeps(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.action).toBe("skip");
    if (result.action === "skip") {
      expect(result.skip_reason).toBe("skip_policy");
    }
  });

  it("skips irrelevant content", async () => {
    const result = await handleEvent(
      makeEvent({ text: "nice weather today" }),
      makeDeps(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.action).toBe("skip");
    if (result.action === "skip") {
      expect(result.skip_reason).toBe("skip_policy");
    }
  });
});
