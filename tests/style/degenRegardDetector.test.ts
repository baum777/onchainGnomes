/**
 * Degen Regard Detector Tests
 */

import { describe, it, expect } from "vitest";
import {
  computeKeywordDensity,
  isMemeCoinEvent,
} from "../../src/style/degenRegardDetector.js";
import type { CanonicalEvent, ClassifierOutput } from "../../src/canonical/types.js";
import type { EnergySignals } from "../../src/style/energyDetector.js";

function makeEvent(text: string, cashtags: string[] = []): CanonicalEvent {
  return {
    event_id: "test-1",
    platform: "twitter",
    trigger_type: "mention",
    author_handle: "@u",
    author_id: "u1",
    text,
    parent_text: null,
    quoted_text: null,
    conversation_context: [],
    cashtags,
    hashtags: [],
    urls: [],
    timestamp: new Date().toISOString(),
  };
}

function makeCls(intent: ClassifierOutput["intent"]): ClassifierOutput {
  return {
    intent,
    target: "claim",
    evidence_class: "contextual_medium",
    bait_probability: 0.1,
    spam_probability: 0.05,
    policy_blocked: false,
    evidence_bullets: [],
    risk_flags: [],
  };
}

describe("computeKeywordDensity", () => {
  it("returns 0 for text without degen keywords", () => {
    const event = makeEvent("just a normal tweet about something");
    expect(computeKeywordDensity(event)).toBe(0);
  });

  it("returns higher density for multiple degen keywords", () => {
    const event = makeEvent("moon 100x lfg ngmi we all gonna make it");
    expect(computeKeywordDensity(event)).toBeGreaterThan(0);
  });
});

describe("isMemeCoinEvent", () => {
  it("returns true for high meme mania + hype intent", () => {
    const event = makeEvent("moon 100x gem");
    const cls = makeCls("hype_claim");
    const signals: EnergySignals = {
      priceMovementPercent: 0.1,
      ctEngagementScore: 0.8,
      viralNarrativeScore: 0.5,
      memeManiaScore: 0.7,
      breakoutDetected: false,
    };
    expect(isMemeCoinEvent(event, cls, signals)).toBe(true);
  });

  it("returns true for 2+ meme keywords + cashtag", () => {
    const event = makeEvent("moon lfg to the moon", ["$PEPE"]);
    const cls = makeCls("irrelevant");
    const signals: EnergySignals = {
      priceMovementPercent: 0,
      ctEngagementScore: 0,
      viralNarrativeScore: 0,
      memeManiaScore: 0.2,
      breakoutDetected: false,
    };
    expect(isMemeCoinEvent(event, cls, signals)).toBe(true);
  });

  it("returns false for low meme + non-hype intent", () => {
    const event = makeEvent("what is solana");
    const cls = makeCls("question");
    const signals: EnergySignals = {
      priceMovementPercent: 0,
      ctEngagementScore: 0.3,
      viralNarrativeScore: 0,
      memeManiaScore: 0.1,
      breakoutDetected: false,
    };
    expect(isMemeCoinEvent(event, cls, signals)).toBe(false);
  });
});
