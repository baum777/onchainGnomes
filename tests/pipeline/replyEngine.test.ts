/**
 * Reply Engine - Pipeline Integration Tests
 *
 * End-to-end tests for the complete reply pipeline.
 */

import { describe, it, expect, vi } from "vitest";
import { processMention, createReplyEngine } from "../../src/pipeline/replyEngine.js";
import type { ReplyEngineInput, ReplyEngineDeps } from "../../src/pipeline/replyEngine.js";
import type { LLMClient } from "../../src/clients/llmClient.js";
import type { XReadClient } from "../../src/clients/xReadClient.js";

describe("Reply Engine", () => {
  // Mock dependencies
  const mockLLM: LLMClient = {
    generateJSON: vi.fn().mockResolvedValue({
      reply_text: "Test reply from LLM",
      truth_category: "OPINION",
      reasoning: "test",
    }),
  };

  const mockXRead: XReadClient = {
    getTweet: vi.fn().mockResolvedValue({
      data: {
        id: "123",
        text: "Test mention",
        author_id: "user_123",
      },
      includes: {
        users: [{ id: "user_123", username: "testuser" }],
      },
    }),
  } as unknown as XReadClient;

  const createMockDeps = (): ReplyEngineDeps => ({
    llm: mockLLM,
    xread: mockXRead,
  });

  const createMockInput = (): ReplyEngineInput => ({
    mention: {
      tweet_id: "mention_123",
      text: "What's the liquidity on this token?",
      author_id: "user_123",
      author_username: "testuser",
      created_at: new Date().toISOString(),
    },
    controls: {
      max_thread_depth: 3,
      enable_timeline_scout: false,
      max_timeline_queries: 5,
      candidate_count: 3,
    },
  });

  describe("processMention", () => {
    it("should return a reply with trace", async () => {
      const deps = createMockDeps();
      const input = createMockInput();

      const result = await processMention(deps, input);

      expect(result.reply_text).toBeTruthy();
      expect(result.reply_text.length).toBeGreaterThan(0);
      expect(result.selected_candidate).toBeDefined();
      expect(result.trace).toBeDefined();
      expect(result.trace.request_id).toBeTruthy();
      expect(result.trace.stages.length).toBeGreaterThan(0);
    });

    it("should include all pipeline stages in trace", async () => {
      const deps = createMockDeps();
      const input = createMockInput();

      const result = await processMention(deps, input);

      const stageNames = result.trace.stages.map(s => s.stage);
      expect(stageNames).toContain("context_build");
      expect(stageNames).toContain("intent_detect");
      expect(stageNames).toContain("persona_route");
      expect(stageNames).toContain("memory_retrieve");
      expect(stageNames).toContain("generation");
      expect(stageNames).toContain("selection");
      expect(stageNames).toContain("safety_check");
      expect(stageNames).toContain("memory_writeback");
      expect(stageNames).toContain("publish");
    });

    it("should return fallback on error", async () => {
      const brokenXRead: XReadClient = {
        getTweet: vi.fn().mockRejectedValue(new Error("X API error")),
      } as unknown as XReadClient;

      const brokenDeps: ReplyEngineDeps = {
        llm: mockLLM,
        xread: brokenXRead,
      };
      const input = createMockInput();

      const result = await processMention(brokenDeps, input);

      // Should still return a reply (fallback)
      expect(result.reply_text).toBeTruthy();
      // May have errors or warnings depending on where failure occurred
      expect(result.trace.stages.length).toBeGreaterThan(0);
    });

    it("should enforce reply length limit", async () => {
      const deps = createMockDeps();
      const input = createMockInput();

      const result = await processMention(deps, input);

      expect(result.reply_text.length).toBeLessThanOrEqual(280);
      expect(result.selected_candidate.estimated_length).toBeLessThanOrEqual(280);
    });
  });

  describe("createReplyEngine", () => {
    it("should create engine with process method", () => {
      const deps = createMockDeps();
      const engine = createReplyEngine(deps);

      expect(engine.process).toBeDefined();
      expect(typeof engine.process).toBe("function");
    });
  });
});
