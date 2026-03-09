/**
 * Prompt Builder Slang Mode Tests
 */

import { describe, it, expect } from "vitest";
import { buildPrompt, promptToLLMInput } from "../../src/canonical/promptBuilder.js";
import type { CanonicalEvent, CanonicalConfig, ThesisBundle, ScoreBundle } from "../../src/canonical/types.js";
import type { StyleContext } from "../../src/style/styleResolver.js";

const mockEvent: CanonicalEvent = {
  event_id: "test-123",
  platform: "twitter",
  trigger_type: "mention",
  author_handle: "testuser",
  author_id: "user-123",
  text: "This chart is looking hot! Moon soon?",
  parent_text: null,
  quoted_text: null,
  conversation_context: [],
  cashtags: ["$TEST"],
  hashtags: ["#crypto"],
  urls: [],
  timestamp: new Date().toISOString(),
};

const mockThesis: ThesisBundle = {
  primary: "empty_hype_no_substance",
  supporting_point: "No evidence provided",
  evidence_bullets: [],
};

const mockScores: ScoreBundle = {
  relevance: 0.7,
  confidence: 0.8,
  severity: 0.3,
  opportunity: 0.6,
  risk: 0.2,
  novelty: 0.5,
};

const mockConfig: CanonicalConfig = {
  persona_name: "Gorky_on_sol",
  platform: "twitter",
  thresholds: {
    min_relevance: 0.45,
    max_risk: 0.55,
    min_opportunity: 0.40,
    min_novelty: 0.35,
  },
  rate_limits: { global_per_minute: 5, per_user_per_minute: 2 },
  retries: { generation_attempts: 2, publish_attempts: 2 },
  safety: {
    allow_raw_links: false,
    allow_wallet_addresses: false,
    identity_attack_block: true,
    financial_advice_block: true,
    unsupported_claim_block: true,
  },
  model_id: "grok-3",
};

describe("buildPrompt with style context", () => {
  it("includes energy_level when style context provided", () => {
    const styleContext: StyleContext = {
      energyLevel: "HIGH",
      slangEnabled: true,
      traitHints: ["playful slang mode", "heat metaphors"],
      slangDensity: "medium",
      tone: "playful",
    };

    const prompt = buildPrompt(mockEvent, "analyst_meme_lite", mockThesis, mockScores, mockConfig, {
      style: styleContext,
    });

    expect(prompt.energy_level).toBe("HIGH");
    expect(prompt.slang_mode).toBe(true);
    expect(prompt.style_hints).toEqual(["playful slang mode", "heat metaphors"]);
  });

  it("includes energy tone in rules when slang enabled", () => {
    const styleContext: StyleContext = {
      energyLevel: "HIGH",
      slangEnabled: true,
      traitHints: ["playful slang mode", "heat metaphors"],
      slangDensity: "medium",
      tone: "playful",
    };

    const prompt = buildPrompt(mockEvent, "analyst_meme_lite", mockThesis, mockScores, mockConfig, {
      style: styleContext,
    });

    const energyRule = prompt.rules.find((r) => r.includes("Energy tone"));
    expect(energyRule).toContain("playful slang mode");
    expect(energyRule).toContain("heat metaphors");
  });

  it("does not include energy tone in rules when slang disabled", () => {
    const styleContext: StyleContext = {
      energyLevel: "LOW",
      slangEnabled: false,
      traitHints: ["dry observation tone"],
      slangDensity: "none",
      tone: "dry",
    };

    const prompt = buildPrompt(mockEvent, "analyst_meme_lite", mockThesis, mockScores, mockConfig, {
      style: styleContext,
    });

    const energyRule = prompt.rules.find((r) => r.includes("Energy tone"));
    expect(energyRule).toBeUndefined();
  });

  it("works without style context (backward compatibility)", () => {
    const prompt = buildPrompt(mockEvent, "analyst_meme_lite", mockThesis, mockScores, mockConfig);

    expect(prompt.energy_level).toBeUndefined();
    expect(prompt.slang_mode).toBeUndefined();
    expect(prompt.style_hints).toBeUndefined();
  });
});

describe("promptToLLMInput with slang mode", () => {
  it("includes slang guidelines when slang_mode is true", () => {
    const prompt = buildPrompt(mockEvent, "market_banter", mockThesis, mockScores, mockConfig, {
      style: {
        energyLevel: "HIGH",
        slangEnabled: true,
        traitHints: ["playful slang mode"],
        slangDensity: "medium",
        tone: "playful",
      },
    });

    const llmInput = promptToLLMInput(prompt);

    expect(llmInput.system).toContain("SLANG MODE ACTIVE");
    expect(llmInput.system).toContain("HEAT / ATTRACTION");
    expect(llmInput.system).toContain("FLIRT / TEASING");
    expect(llmInput.system).toContain("damn this chart hot");
  });

  it("includes energy level in system prompt when provided", () => {
    const prompt = buildPrompt(mockEvent, "market_banter", mockThesis, mockScores, mockConfig, {
      style: {
        energyLevel: "EXTREME",
        slangEnabled: true,
        traitHints: ["max meme energy"],
        slangDensity: "high",
        tone: "unhinged",
      },
    });

    const llmInput = promptToLLMInput(prompt);

    expect(llmInput.system).toContain("Energy level: EXTREME");
  });

  it("does not include slang guidelines when slang_mode is false", () => {
    const prompt = buildPrompt(mockEvent, "analyst_meme_lite", mockThesis, mockScores, mockConfig, {
      style: {
        energyLevel: "LOW",
        slangEnabled: false,
        traitHints: ["dry observation tone"],
        slangDensity: "none",
        tone: "dry",
      },
    });

    const llmInput = promptToLLMInput(prompt);

    expect(llmInput.system).not.toContain("SLANG MODE ACTIVE");
    expect(llmInput.system).not.toContain("HEAT / ATTRACTION");
  });

  it("includes safety reminder in slang guidelines", () => {
    const prompt = buildPrompt(mockEvent, "market_banter", mockThesis, mockScores, mockConfig, {
      style: {
        energyLevel: "HIGH",
        slangEnabled: true,
        traitHints: ["playful slang mode"],
        slangDensity: "medium",
        tone: "playful",
      },
    });

    const llmInput = promptToLLMInput(prompt);

    expect(llmInput.system).toContain("NEVER describe explicit sexual acts or anatomy");
    expect(llmInput.system).toContain("NEVER use pornographic language");
  });

  it("maintains backward compatibility without style context", () => {
    const prompt = buildPrompt(mockEvent, "dry_one_liner", mockThesis, mockScores, mockConfig);
    const llmInput = promptToLLMInput(prompt);

    expect(llmInput.system).toContain("You are Gorky_on_sol");
    expect(llmInput.system).toContain("Response mode: dry_one_liner");
    expect(llmInput.system).not.toContain("SLANG MODE ACTIVE");
  });
});
