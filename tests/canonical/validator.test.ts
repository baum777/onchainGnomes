import { describe, it, expect } from "vitest";
import { validateResponse } from "../../src/canonical/validator.js";
import { DEFAULT_CANONICAL_CONFIG } from "../../src/canonical/types.js";
import type { ClassifierOutput, CanonicalConfig } from "../../src/canonical/types.js";

function makeCls(): ClassifierOutput {
  return {
    intent: "hype_claim",
    target: "claim",
    evidence_class: "contextual_medium",
    bait_probability: 0.1,
    spam_probability: 0.05,
    policy_blocked: false,
    evidence_bullets: [],
    risk_flags: [],
  };
}

describe("validator", () => {
  it("passes valid short reply", () => {
    const result = validateResponse(
      "Nice hype, zero proof.",
      "dry_one_liner",
      makeCls(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.ok).toBe(true);
    expect(result.reason).toBe("passed");
  });

  it("rejects empty output", () => {
    const result = validateResponse(
      "",
      "dry_one_liner",
      makeCls(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("empty_output");
  });

  it("rejects text exceeding char limit", () => {
    const longText = "A".repeat(300);
    const result = validateResponse(
      longText,
      "dry_one_liner",
      makeCls(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("char_limit");
  });

  it("rejects financial advice language", () => {
    const result = validateResponse(
      "You should buy this now, guaranteed profit ahead!",
      "analyst_meme_lite",
      makeCls(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("financial_advice");
  });

  it("rejects wallet addresses when not allowed", () => {
    const result = validateResponse(
      "Send funds to 7nYBm5ph7CZQxLF2Z8cR7aSg9FUE1VNKo2UMo2nh2ky5",
      "analyst_meme_lite",
      makeCls(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("wallet_filter");
  });

  it("allows wallet addresses when config permits", () => {
    const permissive: CanonicalConfig = {
      ...DEFAULT_CANONICAL_CONFIG,
      safety: { ...DEFAULT_CANONICAL_CONFIG.safety, allow_wallet_addresses: true },
    };
    const result = validateResponse(
      "Check 7nYBm5ph7CZQxLF2Z8cR7aSg9FUE1VNKo2UMo2nh2ky5",
      "analyst_meme_lite",
      makeCls(),
      permissive,
    );
    expect(result.checks.wallet_filter).toBe(true);
  });

  it("rejects raw links when not allowed", () => {
    const result = validateResponse(
      "Check this out https://example.com/scam",
      "analyst_meme_lite",
      makeCls(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("raw_link_present");
  });

  it("rejects fabricated assertions", () => {
    const result = validateResponse(
      "Sources confirm that this project is a scam. It has been confirmed by our research.",
      "skeptical_breakdown",
      makeCls(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("unsupported_assertion");
  });

  it("rejects overly long dry_one_liner (mode mismatch)", () => {
    const result = validateResponse(
      "First point here. Second point. Third sentence. Fourth observation is also noted.",
      "dry_one_liner",
      makeCls(),
      DEFAULT_CANONICAL_CONFIG,
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("mode_match");
  });
});
