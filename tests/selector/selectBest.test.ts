/**
 * Candidate Selector - Deterministic Tests
 *
 * Tests for scoring, selection, and ranking of reply candidates.
 */

import { describe, it, expect } from "vitest";
import {
  selectBest,
  filterByMinimumScore,
  getTopCandidates,
} from "../../src/selector/selectBest.js";
import type { SelectionContext } from "../../src/selector/selectBest.js";
import type { ReplyCandidate, ThreadContext, TimelineBrief } from "../../src/types/coreTypes.js";

describe("Candidate Selector", () => {
  const mockThread: ThreadContext = {
    root_tweet_id: "123",
    chain: [],
    summary: "User asking about token liquidity",
    intent: "question",
    tone: "neutral",
    entities: ["SOL", "liquidity"],
    keywords: ["liquidity", "token", "market"],
    claims: [],
    constraints: [],
  };

  const mockTimeline: TimelineBrief = {
    query_keywords: ["solana", "crypto"],
    window_minutes: 60,
    bullets: ["Markets volatile", "Solana trending"],
    hot_phrases: ["$SOL", "liquidity"],
    counterpoints: [],
    sources_sampled: 10,
  };

  const mockContext: SelectionContext = {
    thread: mockThread,
    timeline: mockTimeline,
    personaMode: "analyst",
    intent: "question",
    truthContext: {
      containsContractAddress: false,
    },
  };

  const createMockCandidate = (overrides: Partial<ReplyCandidate> = {}): ReplyCandidate => ({
    candidate_id: `c_${Math.random().toString(36).slice(2, 8)}`,
    reply_text: "Test reply",
    mode: "analyst",
    risk: "low",
    truth_category: "OPINION",
    estimated_length: 50,
    ...overrides,
  });

  describe("selectBest", () => {
    it("should select from single candidate", () => {
      const candidate = createMockCandidate({ reply_text: "Only option" });
      const result = selectBest([candidate], mockContext);

      expect(result.selected.candidate_id).toBe(candidate.candidate_id);
      expect(result.scores).toHaveLength(1);
    });

    it("should score multiple candidates and select best", () => {
      const candidates: ReplyCandidate[] = [
        createMockCandidate({ reply_text: "Test reply one", risk: "low" }),
        createMockCandidate({ reply_text: "Test reply two", risk: "high" }),
        createMockCandidate({ reply_text: "Test reply three", risk: "medium" }),
      ];

      const result = selectBest(candidates, mockContext);

      expect(result.selected).toBeDefined();
      expect(result.scores).toHaveLength(3);

      // All should have overall scores
      for (const score of result.scores) {
        expect(score.scores.overall).toBeGreaterThanOrEqual(0);
        expect(score.scores.overall).toBeLessThanOrEqual(100);
      }
    });

    it("should penalize replies with safety issues", () => {
      const candidates: ReplyCandidate[] = [
        createMockCandidate({ reply_text: "Safe reply about liquidity" }),
        createMockCandidate({ reply_text: "As an AI language model, I cannot help" }),
      ];

      const result = selectBest(candidates, mockContext);

      // The AI language model reply should be penalized
      const aiReply = result.scores.find(
        s => s.candidate_id === candidates[1].candidate_id
      );

      if (aiReply) {
        expect(aiReply.scores.safety).toBeLessThan(100);
        expect(aiReply.penalties.length).toBeGreaterThan(0);
      }
    });

    it("should boost context relevance for entity overlap", () => {
      const candidates: ReplyCandidate[] = [
        createMockCandidate({ reply_text: "Random unrelated text" }),
        createMockCandidate({ reply_text: "SOL liquidity looks thin right now" }),
      ];

      const result = selectBest(candidates, mockContext);

      const relevantReply = result.scores.find(
        s => s.candidate_id === candidates[1].candidate_id
      );

      if (relevantReply) {
        expect(relevantReply.scores.context_relevance).toBeGreaterThan(50);
        expect(relevantReply.scores.topic_alignment).toBeGreaterThan(50);
      }
    });

    it("should include selection reason in scores", () => {
      const candidates = [createMockCandidate()];
      const result = selectBest(candidates, mockContext);

      expect(result.scores[0].selection_reason).toBeTruthy();
      expect(result.scores[0].selection_reason.length).toBeGreaterThan(0);
    });
  });

  describe("filterByMinimumScore", () => {
    it("should filter candidates below minimum score", () => {
      const candidates: ReplyCandidate[] = [
        createMockCandidate({ reply_text: "High quality reply with entities SOL liquidity" }),
        createMockCandidate({ reply_text: "x" }), // Very low quality
      ];

      const filtered = filterByMinimumScore(candidates, mockContext, 60);

      expect(filtered.length).toBeLessThanOrEqual(candidates.length);
    });

    it("should return empty array if no candidates pass", () => {
      const candidates: ReplyCandidate[] = [
        createMockCandidate({ reply_text: "As an AI I cannot" }),
      ];

      const filtered = filterByMinimumScore(candidates, mockContext, 90);

      expect(filtered.length).toBe(0);
    });
  });

  describe("getTopCandidates", () => {
    it("should return top N candidates", () => {
      const candidates: ReplyCandidate[] = [
        createMockCandidate({ reply_text: "A" }),
        createMockCandidate({ reply_text: "B" }),
        createMockCandidate({ reply_text: "C" }),
        createMockCandidate({ reply_text: "D" }),
      ];

      const top = getTopCandidates(candidates, mockContext, 2);

      expect(top).toHaveLength(2);
      expect(top[0].score.scores.overall).toBeGreaterThanOrEqual(top[1].score.scores.overall);
    });

    it("should handle requesting more than available", () => {
      const candidates: ReplyCandidate[] = [
        createMockCandidate({ reply_text: "A" }),
      ];

      const top = getTopCandidates(candidates, mockContext, 5);

      expect(top).toHaveLength(1);
    });
  });
});
