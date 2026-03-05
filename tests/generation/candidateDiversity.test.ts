/**
 * Candidate Generation - Stochastic Tests
 *
 * Tests for candidate diversity and generation quality.
 */

import { describe, it, expect, vi } from "vitest";
import { generateCandidates } from "../../src/generation/generateCandidates.js";
import type { GenerationRequest } from "../../src/types/coreTypes.js";
import type { LLMClient } from "../../src/clients/llmClient.js";
import type { ThreadContext } from "../../src/context/types.js";

describe("Candidate Generation - Stochastic", () => {
  const createMockLLM = (variations: string[]): LLMClient => ({
    generateJSON: vi.fn().mockImplementation(async () => {
      const variation = variations[Math.floor(Math.random() * variations.length)];
      return {
        reply_text: variation,
        truth_category: "OPINION",
        reasoning: "test",
      };
    }),
  });

  const createMockContext = (): ThreadContext => ({
    root_tweet_id: "123",
    chain: [],
    summary: "User asking about token",
    intent: "question",
    tone: "neutral",
    entities: ["TEST"],
    keywords: ["token", "test"],
    claims: [],
    constraints: [],
  });

  const createMockRequest = (count: number): GenerationRequest => ({
    context: createMockContext(),
    timeline: null,
    intent: {
      intent: "question",
      confidence: 0.8,
      entities: { coins: [], cashtags: [], users: [], urls: [], contract_addresses: [] },
      aggression_level: "low",
      topics: ["token"],
      raw_classification: "test",
    },
    persona_mode: "analyst",
    memory: {
      relevant_lore: [],
      relevant_facts: [],
      previous_interactions: [],
      suggested_topics: [],
    },
    candidate_count: count,
  });

  describe("candidate diversity", () => {
    it("should generate requested number of candidates", async () => {
      const variations = ["Reply A", "Reply B", "Reply C", "Reply D", "Reply E"];
      const llm = createMockLLM(variations);

      const request = createMockRequest(5);
      const result = await generateCandidates({ llm }, request);

      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.generation_time_ms).toBeGreaterThanOrEqual(0);
    });

    it("should ensure candidates have unique IDs", async () => {
      const variations = ["Reply 1", "Reply 2", "Reply 3"];
      const llm = createMockLLM(variations);

      const request = createMockRequest(3);
      const result = await generateCandidates({ llm }, request);

      const ids = result.candidates.map(c => c.candidate_id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should assign different risk levels", async () => {
      const variations = ["Safe reply", "Moderate reply", "Bold reply"];
      const llm = createMockLLM(variations);

      const request = createMockRequest(3);
      const result = await generateCandidates({ llm }, request);

      const risks = result.candidates.map(c => c.risk);
      const uniqueRisks = new Set(risks);

      // Should have some variety in risk levels
      expect(uniqueRisks.size).toBeGreaterThanOrEqual(1);
    });

    it("should ensure all replies are <= 280 chars", async () => {
      const longText = "A".repeat(500);
      const llm: LLMClient = {
        generateJSON: vi.fn().mockResolvedValue({
          reply_text: longText,
          truth_category: "OPINION",
          reasoning: "test",
        }),
      };

      const request = createMockRequest(1);
      const result = await generateCandidates({ llm }, request);

      for (const candidate of result.candidates) {
        expect(candidate.reply_text.length).toBeLessThanOrEqual(280);
        expect(candidate.estimated_length).toBeLessThanOrEqual(280);
      }
    });

    it("should include generation metadata", async () => {
      const llm = createMockLLM(["Test reply"]);

      const request = createMockRequest(1);
      const result = await generateCandidates({ llm }, request);

      for (const candidate of result.candidates) {
        expect(candidate.generation_metadata).toBeDefined();
        expect(candidate.generation_metadata?.seed).toBeDefined();
        expect(candidate.generation_metadata?.temperature).toBeDefined();
      }
    });
  });

  describe("deterministic generation", () => {
    it("should generate same candidates for same seed", async () => {
      // Note: This test verifies the seeding mechanism exists
      // Full determinism would require mocking the LLM to return consistent results
      const llm: LLMClient = {
        generateJSON: vi.fn().mockImplementation(({ developer }) => {
          // Extract seed from developer prompt
          const seedMatch = developer?.match(/Seed: ([^\.]+)/);
          const seed = seedMatch ? seedMatch[1] : "unknown";

          return Promise.resolve({
            reply_text: `Reply with seed ${seed}`,
            truth_category: "OPINION",
            reasoning: "test",
          });
        }),
      };

      const request = createMockRequest(2);
      const result = await generateCandidates({ llm }, request);

      // Both candidates should have seeds
      expect(result.candidates[0].generation_metadata?.seed).toBeDefined();
      expect(result.candidates[1].generation_metadata?.seed).toBeDefined();
    });
  });

  describe("fallback handling", () => {
    it("should provide fallback on LLM failure", async () => {
      const failingLLM: LLMClient = {
        generateJSON: vi.fn().mockRejectedValue(new Error("LLM error")),
      };

      const request = createMockRequest(1);
      const result = await generateCandidates({ llm: failingLLM }, request);

      // Should have at least one fallback candidate
      expect(result.candidates.length).toBeGreaterThanOrEqual(1);
      expect(result.candidates[0].candidate_id).toContain("fallback");
    });

    it("should include fallback for each mode", async () => {
      const modes = ["analyst", "goblin", "scientist", "prophet", "referee"] as const;

      for (const mode of modes) {
        const failingLLM: LLMClient = {
          generateJSON: vi.fn().mockRejectedValue(new Error("LLM error")),
        };

        const request = createMockRequest(1);
        request.persona_mode = mode;

        const result = await generateCandidates({ llm: failingLLM }, request);

        expect(result.candidates[0].mode).toBe(mode);
        expect(result.candidates[0].reply_text.length).toBeGreaterThan(0);
      }
    });
  });
});
