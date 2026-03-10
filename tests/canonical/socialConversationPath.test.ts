import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleEvent, type PipelineDeps } from "../../src/canonical/pipeline.js";
import { DEFAULT_CANONICAL_CONFIG } from "../../src/canonical/types.js";
import type { CanonicalEvent } from "../../src/canonical/types.js";
import type { LLMClient } from "../../src/clients/llmClient.js";
import { cacheClear } from "../../src/ops/memoryCache.js";
import fs from "node:fs";
import path from "node:path";

const AUDIT_FILE = path.join(process.cwd(), "data", "audit_log.jsonl");

let eventCounter = 0;
function makeEvent(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  eventCounter++;
  return {
    event_id: `social_${eventCounter}_${Date.now()}`,
    platform: "twitter",
    trigger_type: "mention",
    author_handle: "@testuser",
    author_id: "user_1",
    text: "hey",
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

function createMockLLM(reply = "yo, what's good."): LLMClient {
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

describe("social conversation path — integration", () => {
  beforeEach(async () => {
    await cacheClear();
    if (fs.existsSync(AUDIT_FILE)) fs.unlinkSync(AUDIT_FILE);
  });
  afterEach(() => {
    if (fs.existsSync(AUDIT_FILE)) fs.unlinkSync(AUDIT_FILE);
  });

  it('altseason case: "@gorkypf is there an altseason on the horizon?" is not skipped', async () => {
    const result = await handleEvent(
      makeEvent({ text: "@gorkypf is there an altseason on the horizon?" }),
      makeDeps("Altseason? The charts whisper, but the void hasn't confirmed."),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.action).toBe("publish");
    if (result.action === "publish") {
      expect(result.mode).toBe("market_banter");
      expect(result.audit.path).toBe("social");
    }
  });

  it('"hey" case: not classified as irrelevant, not skipped', async () => {
    const result = await handleEvent(
      makeEvent({ text: "hey" }),
      makeDeps("yo."),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.action).toBe("publish");
    if (result.action === "publish") {
      expect(result.mode).toBe("social_banter");
      expect(result.audit.classifier_output.intent).toBe("greeting");
      expect(result.audit.path).toBe("social");
    }
  });

  it('"gm" case: greeting publishes', async () => {
    const result = await handleEvent(
      makeEvent({ text: "gm" }),
      makeDeps("gm."),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.action).toBe("publish");
    if (result.action === "publish") {
      expect(result.mode).toBe("social_banter");
    }
  });

  it('"who are you?" publishes as persona_reply', async () => {
    const result = await handleEvent(
      makeEvent({ text: "who are you?" }),
      makeDeps("I am the one who audits."),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.action).toBe("publish");
    if (result.action === "publish") {
      expect(result.mode).toBe("persona_reply");
    }
  });

  it('"tell me your lore" publishes as lore_drop', async () => {
    const result = await handleEvent(
      makeEvent({ text: "tell me your lore" }),
      makeDeps("Born in the liquidity void."),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.action).toBe("publish");
    if (result.action === "publish") {
      expect(result.mode).toBe("lore_drop");
    }
  });

  it("spam still gets blocked even with social greeting prefix", async () => {
    const result = await handleEvent(
      makeEvent({ text: "gm! DM me for free airdrop click link join now giveaway" }),
      makeDeps(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.action).toBe("skip");
    if (result.action === "skip") {
      expect(["skip_policy", "skip_safety_filter"]).toContain(result.skip_reason);
    }
  });

  it("audit path still works for hype claims", async () => {
    const result = await handleEvent(
      makeEvent({
        text: "$SOL mooning 100x gem guaranteed easy money LFG",
        cashtags: ["$SOL"],
      }),
      makeDeps("Zero proof, pure noise."),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.action).toBe("publish");
    if (result.action === "publish") {
      expect(["dry_one_liner", "analyst_meme_lite", "skeptical_breakdown", "soft_deflection"]).toContain(result.mode);
      expect(result.audit.path).toBe("audit");
    }
  });

  it("irrelevant content still gets skipped", async () => {
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
