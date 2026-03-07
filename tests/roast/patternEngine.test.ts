/**
 * Pattern Engine Unit Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  selectPattern,
  resetRecentPatternStore,
} from "../../src/roast/patternEngine.js";
import type { ThesisBundle, ScoreBundle } from "../../src/canonical/types.js";
import type { NarrativeResult } from "../../src/narrative/narrativeMapper.js";

function makeThesis(primary: ThesisBundle["primary"]): ThesisBundle {
  return { primary, supporting_point: null, evidence_bullets: [] };
}

function makeScores(overrides?: Partial<ScoreBundle>): ScoreBundle {
  return {
    relevance: 0.6,
    confidence: 0.7,
    severity: 0.4,
    opportunity: 0.6,
    risk: 0.2,
    novelty: 0.5,
    ...overrides,
  };
}

describe("patternEngine", () => {
  beforeEach(() => {
    resetRecentPatternStore();
  });

  it("selects hype_detection for empty_hype_no_substance + hopium narrative", () => {
    const thesis = makeThesis("empty_hype_no_substance");
    const narrative: NarrativeResult = {
      label: "hopium_wagmi_diamond_hands",
      confidence: 0.8,
      sentiment: "positive",
    };
    const scores = makeScores();

    const result = selectPattern(thesis, narrative, scores, "user1");

    expect(result.pattern_id).toBe("hype_detection");
    expect(result.framing).toContain("Hype");
    expect(result.fallback_used).toBe(false);
  });

  it("selects liquidity_illusion for suspicious_behavior + liquidity narrative", () => {
    const thesis = makeThesis("suspicious_behavior_pattern");
    const narrative: NarrativeResult = {
      label: "liquidity_volume_spike",
      confidence: 0.7,
      sentiment: "neutral",
    };
    const scores = makeScores();

    const result = selectPattern(thesis, narrative, scores, "user2");

    expect(result.pattern_id).toBe("liquidity_illusion");
    expect(result.fallback_used).toBe(false);
  });

  it("selects this_time_different for this_cycle_different narrative", () => {
    const thesis = makeThesis("narrative_stronger_than_product");
    const narrative: NarrativeResult = {
      label: "this_cycle_different",
      confidence: 0.9,
      sentiment: "positive",
    };
    const scores = makeScores();

    const result = selectPattern(thesis, narrative, scores, "user3");

    expect(result.pattern_id).toBe("this_time_different");
    expect(result.framing).toContain("different");
  });

  it("falls back to narrative_vs_reality when no pattern matches", () => {
    const thesis = makeThesis("social_engagement");
    const narrative: NarrativeResult = {
      label: "unclassified",
      confidence: 0.3,
      sentiment: "neutral",
    };
    const scores = makeScores();

    const result = selectPattern(thesis, narrative, scores, "user4");

    expect(result.pattern_id).toBe("narrative_vs_reality");
    expect(result.fallback_used).toBe(true);
  });

  it("applies recent-pattern penalty for repeated usage", () => {
    const thesis = makeThesis("empty_hype_no_substance");
    const narrative: NarrativeResult = {
      label: "hopium_wagmi_diamond_hands",
      confidence: 0.8,
      sentiment: "positive",
    };
    const scores = makeScores();

    const r1 = selectPattern(thesis, narrative, scores, "user5");
    const r2 = selectPattern(thesis, narrative, scores, "user5");

    expect(r1.pattern_id).toBe("hype_detection");
    expect(r2.pattern_id).toBe("hopium_overdose");
  });
});
