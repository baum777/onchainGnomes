/**
 * Full Spectrum Prompt Builder Tests
 */

import { describe, it, expect } from "vitest";
import { buildMasterPrompt } from "../../src/canonical/fullSpectrumPromptBuilder.js";
import type {
  CanonicalEvent,
  ScoreBundle,
  ThesisBundle,
} from "../../src/canonical/types.js";
import type { StyleContext } from "../../src/style/styleResolver.js";

const mockEvent: CanonicalEvent = {
  event_id: "test-1",
  platform: "twitter",
  trigger_type: "mention",
  author_handle: "@user",
  author_id: "u1",
  text: "$SOL mooning",
  parent_text: null,
  quoted_text: null,
  conversation_context: [],
  cashtags: ["$SOL"],
  hashtags: [],
  urls: [],
  timestamp: new Date().toISOString(),
};

const mockThesis: ThesisBundle = {
  primary: "empty_hype_no_substance",
  supporting_point: null,
  evidence_bullets: [],
};

const mockScores: ScoreBundle = {
  relevance: 0.7,
  confidence: 0.8,
  severity: 0.5,
  opportunity: 0.6,
  risk: 0.2,
  novelty: 0.5,
};

describe("buildMasterPrompt", () => {
  it("returns system prompt with base content when no style", () => {
    const input = buildMasterPrompt(
      mockEvent,
      mockThesis,
      mockScores,
    );
    expect(input.system).toContain("GORKY");
    expect(input.system).toContain("JSON");
    expect(input.system).not.toContain("HORNY-SLANG");
    expect(input.system).not.toContain("SAVAGE");
  });

  it("includes bissigkeit hint in user when estimatedBissigkeit provided", () => {
    const input = buildMasterPrompt(
      mockEvent,
      mockThesis,
      mockScores,
      undefined,
      undefined,
      undefined,
      7.2,
    );
    expect(input.user).toContain("Initial estimated bissigkeit");
    expect(input.user).toContain("~7.2");
  });

  it("includes horny-slang block when style.slangEnabled", () => {
    const style: StyleContext = {
      energyLevel: "HIGH",
      slangEnabled: true,
      savage_horny_slang: false,
      ultra_savage: false,
      degen_regard: false,
      traitHints: [],
      slangDensity: "medium",
      tone: "playful",
    };
    const input = buildMasterPrompt(
      mockEvent,
      mockThesis,
      mockScores,
      undefined,
      undefined,
      style,
    );
    expect(input.system).toContain("HORNY-SLANG ENERGY MODE ACTIVE");
    expect(input.system).toContain("damn this chart hot");
  });

  it("includes savage block when style.savage_horny_slang", () => {
    const style: StyleContext = {
      energyLevel: "EXTREME",
      slangEnabled: true,
      savage_horny_slang: true,
      ultra_savage: false,
      degen_regard: false,
      traitHints: [],
      slangDensity: "high",
      tone: "unhinged",
    };
    const input = buildMasterPrompt(
      mockEvent,
      mockThesis,
      mockScores,
      undefined,
      undefined,
      style,
    );
    expect(input.system).toContain("SAVAGE HORNY-SLANG ACTIVE");
    expect(input.system).toContain("sniffing blood");
  });

  it("includes ultra-savage block when style.ultra_savage", () => {
    const style: StyleContext = {
      energyLevel: "EXTREME",
      slangEnabled: true,
      savage_horny_slang: true,
      ultra_savage: true,
      degen_regard: false,
      traitHints: [],
      slangDensity: "high",
      tone: "unhinged",
    };
    const input = buildMasterPrompt(
      mockEvent,
      mockThesis,
      mockScores,
      undefined,
      undefined,
      style,
    );
    expect(input.system).toContain("ULTRA-SAVAGE MODE");
    expect(input.system).toContain("nuked");
    expect(input.system).toContain("rekt");
  });

  it("includes degen-regard block when style.degen_regard", () => {
    const style: StyleContext = {
      energyLevel: "HIGH",
      slangEnabled: true,
      savage_horny_slang: false,
      ultra_savage: false,
      degen_regard: true,
      traitHints: [],
      slangDensity: "medium",
      tone: "playful",
    };
    const input = buildMasterPrompt(
      mockEvent,
      mockThesis,
      mockScores,
      undefined,
      undefined,
      style,
    );
    expect(input.system).toContain("DEGEN / REGARD MODE ACTIVE");
    expect(input.system).toContain("ngmi");
  });
});
