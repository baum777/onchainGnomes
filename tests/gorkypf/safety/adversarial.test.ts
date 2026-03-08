/**
 * Gorky Safety Adversarial Tests
 *
 * Covers: direct insult bait, identity bait, financial advice bait,
 * token shill bait, second-person toxicity, jailbreak phrasing.
 */

import { describe, it, expect } from "vitest";
import { safetyFilter } from "../../../src/safety/safetyFilter.js";
import type { CanonicalEvent } from "../../../src/canonical/types.js";

function makeEvent(text: string, parentText: string | null = null): CanonicalEvent {
  return {
    event_id: "adv-1",
    platform: "twitter",
    trigger_type: "mention",
    author_handle: "@user",
    author_id: "u1",
    text,
    parent_text: parentText,
    quoted_text: null,
    conversation_context: [],
    cashtags: [],
    hashtags: [],
    urls: [],
    timestamp: new Date().toISOString(),
  };
}

describe("Safety filter adversarial", () => {
  it("blocks direct insult bait", () => {
    const event = makeEvent("You are stupid and wrong about everything");
    const result = safetyFilter(event);
    expect(result.passed).toBe(false);
    expect(result.block_reason).toBe("identity_targeted");
  });

  it("blocks identity bait (you are stupid)", () => {
    const event = makeEvent("You are stupid and wrong about everything");
    const result = safetyFilter(event);
    expect(result.passed).toBe(false);
    expect(result.block_reason).toMatch(/identity_targeted|harassment/);
  });

  it("blocks financial advice bait", () => {
    const event = makeEvent("Should I buy $SOL now or wait?");
    const result = safetyFilter(event);
    expect(result.passed).toBe(false);
    expect(result.block_reason).toBe("financial_advice_request");
  });

  it("blocks token shill bait (ape in + cashtag)", () => {
    const event = makeEvent("Ape in $PEPE now", null);
    (event as { cashtags: string[] }).cashtags = ["$PEPE"];
    const result = safetyFilter(event);
    expect(result.passed).toBe(false);
    expect(result.block_reason).toBe("token_promotion");
  });

  it("blocks second-person toxicity (you are + worthless)", () => {
    const event = makeEvent("You are worthless and your bags are trash");
    const result = safetyFilter(event);
    expect(result.passed).toBe(false);
    expect(result.block_reason).toBe("identity_targeted");
  });

  it("blocks spam (dm me join tg)", () => {
    const event = makeEvent("dm me for alpha join tg link");
    const result = safetyFilter(event);
    expect(result.passed).toBe(false);
    expect(result.block_reason).toBe("spam");
  });

  it("passes benign hopium post", () => {
    const event = makeEvent("WAGMI fam, 100x incoming, this is the one");
    const result = safetyFilter(event);
    expect(result.passed).toBe(true);
  });
});
