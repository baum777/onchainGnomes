/**
 * Gnome Selector Tests — Fallback to configured safe gnome when disabled
 */

import { describe, it, expect, beforeEach } from "vitest";
import { clearRegistry } from "../../src/gnomes/registry.js";
import { loadGnomes } from "../../src/gnomes/loadGnomes.js";
import { selectGnome } from "../../src/routing/gnomeSelector.js";
import { extractSelectorFeatures } from "../../src/routing/selectorFeatures.js";
import type { ClassifierOutput, ScoreBundle } from "../../src/canonical/types.js";
import type { CanonicalEvent } from "../../src/canonical/types.js";

function makeEvent(overrides?: Partial<CanonicalEvent>): CanonicalEvent {
  return {
    event_id: "ev_1",
    platform: "twitter",
    trigger_type: "mention",
    author_handle: "user1",
    author_id: "123",
    text: "hello gnomes",
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

function makeClassifier(overrides?: Partial<ClassifierOutput>): ClassifierOutput {
  return {
    intent: "greeting",
    target: "conversation",
    evidence_class: "contextual_medium",
    bait_probability: 0.1,
    spam_probability: 0,
    policy_blocked: false,
    evidence_bullets: [],
    risk_flags: [],
    ...overrides,
  };
}

const defaultScores: ScoreBundle = {
  relevance: 0.7,
  confidence: 0.8,
  severity: 0.3,
  opportunity: 0.5,
  risk: 0.2,
  novelty: 0.4,
};

describe("Gnome Selector", () => {
  beforeEach(async () => {
    clearRegistry();
    await loadGnomes();
  });

  it("returns configured safe gnome when GNOMES_ENABLED=false", () => {
    const features = extractSelectorFeatures(
      makeClassifier(),
      defaultScores,
      makeEvent(),
    );
    const result = selectGnome(features, "social_banter", {
      enabled: false,
      defaultSafeGnome: "stillhalter",
    });
    expect(result.selectedGnomeId).toBe("stillhalter");
    expect(result.reasoning).toContain("gnomes_disabled_or_empty");
  });

  it("returns a loaded gnome when enabled", () => {
    const features = extractSelectorFeatures(
      makeClassifier(),
      defaultScores,
      makeEvent(),
    );
    const result = selectGnome(features, "social_banter", {
      enabled: true,
      defaultSafeGnome: "stillhalter",
    });
    expect(result.selectedGnomeId.length).toBeGreaterThan(0);
  });

  it("includes responseMode in result", () => {
    const features = extractSelectorFeatures(
      makeClassifier(),
      defaultScores,
      makeEvent(),
    );
    const result = selectGnome(features, "lore_drop", { enabled: true });
    expect(result.responseMode).toBe("lore_drop");
  });
});
