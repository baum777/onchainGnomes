import { describe, it, expect } from "vitest";
import {
  ThreadSummarySchema,
  TimelineSummarySchema,
  TopicsSchema,
  IntentResultSchema,
  TruthGateSchema,
  PersonaRouteSchema,
  CandidatesSchema,
  CandidateSelectionSchema,
  SafetyRewriteSchema,
  LoreDeltaResultSchema,
} from "../../src/types/coreTypes.js";
import { parseWithZod } from "../_helpers/zodHarness.js";
import { mockLLM } from "../_mocks/mockLLM.js";

describe("Contract: Prompt JSON outputs validate against Zod schemas", () => {
  it("thread summarizer output", () => {
    const o = mockLLM.summarizeThread("t_001");
    const parsed = parseWithZod(ThreadSummarySchema, o);
    expect(parsed.thread_summary.length).toBeGreaterThan(10);
  });

  it("timeline summarizer output", () => {
    const o = mockLLM.summarizeTimeline("t_001");
    const parsed = parseWithZod(TimelineSummarySchema, o);
    expect(parsed.narrative_summary.length).toBeGreaterThan(10);
  });

  it("topic extractor output (weights sum to 1.0)", () => {
    const o = mockLLM.extractTopics("t_001");
    const parsed = parseWithZod(TopicsSchema, o);
    const sum = parsed.topics.reduce((a, t) => a + t.weight, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it("intent detector output", () => {
    const o = mockLLM.detectIntent("t_001", "What do you think about SOL liquidity?");
    const parsed = parseWithZod(IntentResultSchema, o);
    expect(parsed.intent).toBeTruthy();
  });

  it("truth gate output", () => {
    const o = mockLLM.truthGate("coin_query", { has_address: false, has_coin_facts: false });
    const parsed = parseWithZod(TruthGateSchema, o);
    expect(parsed.truth_level).toBe("FACT");
  });

  it("persona route output", () => {
    const o = mockLLM.personaRoute("t_001", "market_request", 0);
    const parsed = parseWithZod(PersonaRouteSchema, o);
    expect(parsed.mode).toBeTruthy();
  });

  it("candidate generation output", () => {
    const o = mockLLM.generateCandidates("t_001", 3, "analyst", "OPINION");
    const parsed = parseWithZod(CandidatesSchema, o);
    expect(parsed.candidates).toHaveLength(3);
  });

  it("selector output", () => {
    const c = mockLLM.generateCandidates("t_001", 3, "analyst", "OPINION").candidates;
    const o = mockLLM.selectBest(c, "t_001");
    const parsed = parseWithZod(CandidateSelectionSchema, o);
    expect(parsed.selected_candidate_id).toMatch(/^c\d+$/);
  });

  it("safety rewrite output", () => {
    const o = mockLLM.safetyRewrite("hello world", { unverified_facts: false, meta_leak: false });
    const parsed = parseWithZod(SafetyRewriteSchema, o);
    expect(parsed.action).toBe("post");
  });

  it("lore delta output", () => {
    const o = mockLLM.loreDelta("lore_query", "LORE", "From the liquidity void...");
    const parsed = parseWithZod(LoreDeltaResultSchema, o);
    expect(parsed.should_write).toBe(true);
    expect(parsed.lore_deltas.length).toBeGreaterThan(0);
  });
});
