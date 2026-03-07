/**
 * Narrative Mapper Unit Tests
 */

import { describe, it, expect } from "vitest";
import { mapNarrative } from "../../src/narrative/narrativeMapper.js";
import type { CanonicalEvent } from "../../src/canonical/types.js";
import type { ClassifierOutput } from "../../src/canonical/types.js";

function makeEvent(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    event_id: "ev1",
    platform: "twitter",
    trigger_type: "mention",
    author_handle: "user",
    author_id: "uid1",
    text: "test tweet",
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

function makeClassifier(overrides: Partial<ClassifierOutput> = {}): ClassifierOutput {
  return {
    intent: "hype_claim",
    target: "claim",
    evidence_class: "weak_speculative",
    bait_probability: 0.1,
    spam_probability: 0.1,
    policy_blocked: false,
    evidence_bullets: [],
    risk_flags: [],
    ...overrides,
  };
}

describe("narrativeMapper", () => {
  it("detects hopium_wagmi_diamond_hands for WAGMI text", () => {
    const event = makeEvent({ text: "WAGMI fam, 100x incoming" });
    const cls = makeClassifier({ intent: "hype_claim" });

    const result = mapNarrative(event, cls);

    expect(result).not.toBeNull();
    expect(result!.label).toBe("hopium_wagmi_diamond_hands");
    expect(result!.confidence).toBeGreaterThan(0.5);
  });

  it("detects this_cycle_different for cycle-different claims", () => {
    const event = makeEvent({
      text: "This cycle is different, utility will win",
    });
    const cls = makeClassifier({ intent: "market_narrative" });

    const result = mapNarrative(event, cls);

    expect(result).not.toBeNull();
    expect(result!.label).toBe("this_cycle_different");
  });

  it("detects post_hype_silence for post-announcement decay", () => {
    const event = makeEvent({
      text: "Launched last week. Now... crickets.",
    });
    const cls = makeClassifier({ intent: "launch_announcement" });

    const result = mapNarrative(event, cls);

    expect(result).not.toBeNull();
    expect(result!.label).toBe("post_hype_silence");
  });

  it("returns unclassified for generic text", () => {
    const event = makeEvent({ text: "Hello there" });
    const cls = makeClassifier({ intent: "greeting" });

    const result = mapNarrative(event, cls);

    expect(result).not.toBeNull();
    expect(result!.label).toBe("unclassified");
  });
});
