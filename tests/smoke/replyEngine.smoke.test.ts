/**
 * Smoke test: replyEngine with LAUNCH_MODE=dry_run
 *
 * Asserts output constraints: <=280 chars, safe (no forbidden terms).
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { processMention } from "../../src/pipeline/replyEngine.js";
import type { ReplyEngineInput, ReplyEngineDeps } from "../../src/pipeline/replyEngine.js";
import type { LLMClient } from "../../src/clients/llmClient.js";
import type { XReadClient } from "../../src/clients/xReadClient.js";
import { resetLaunchEnvCache } from "../../src/config/env.js";

const FORBIDDEN_TERMS = ["trace_id", "score", "xp", "threshold", "cooldown", "internal"];

describe("Smoke: replyEngine output constraints", () => {
  const mockLLM: LLMClient = {
    generateJSON: vi.fn().mockResolvedValue({
      reply_text: "Chart patterns suggest volatility. DYOR — data doesn't lie.",
      truth_category: "OPINION",
      reasoning: "neutral",
    }),
  };

  const mockXRead: XReadClient = {
    getTweet: vi.fn().mockResolvedValue({
      data: {
        id: "smoke_123",
        text: "What about $TOKEN?",
        author_id: "u1",
      },
      includes: {
        users: [{ id: "u1", username: "testuser" }],
      },
    }),
  } as unknown as XReadClient;

  beforeAll(() => {
    vi.stubEnv("LAUNCH_MODE", "dry_run");
    resetLaunchEnvCache();
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    resetLaunchEnvCache();
  });

  it("returns reply <= 280 chars", async () => {
    const deps: ReplyEngineDeps = { llm: mockLLM, xread: mockXRead };
    const input: ReplyEngineInput = {
      mention: {
        tweet_id: "smoke_123",
        text: "What about $TOKEN?",
        author_id: "u1",
        author_username: "testuser",
        created_at: new Date().toISOString(),
      },
      controls: {
        max_thread_depth: 3,
        enable_timeline_scout: false,
        max_timeline_queries: 5,
        candidate_count: 3,
      },
    };

    const result = await processMention(deps, input);

    expect(result.reply_text).toBeTruthy();
    expect(result.reply_text.length).toBeLessThanOrEqual(280);
  });

  it("reply contains no forbidden internal terms", async () => {
    const deps: ReplyEngineDeps = { llm: mockLLM, xread: mockXRead };
    const input: ReplyEngineInput = {
      mention: {
        tweet_id: "smoke_456",
        text: "Is this token safe?",
        author_id: "u2",
        author_username: "otheruser",
        created_at: new Date().toISOString(),
      },
      controls: {
        max_thread_depth: 3,
        enable_timeline_scout: false,
        max_timeline_queries: 5,
        candidate_count: 3,
      },
    };

    const result = await processMention(deps, input);
    const lower = result.reply_text.toLowerCase();

    for (const term of FORBIDDEN_TERMS) {
      expect(lower).not.toContain(term);
    }
  });
});
