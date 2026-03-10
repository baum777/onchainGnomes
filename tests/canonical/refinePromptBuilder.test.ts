import { describe, it, expect } from "vitest";
import { buildRefinePrompt } from "../../src/canonical/refinePromptBuilder.js";

describe("refinePromptBuilder", () => {
  it("builds system prompt with refine rules", () => {
    const result = buildRefinePrompt({
      previousReply: "Short.",
      mentionText: "We have sloppy concentrated launch",
      thesis: "claim_exceeds_evidence",
      relevanceScore: 0.7,
      sentimentIntensity: 0.6,
      expectedKeywords: ["sloppy", "concentrated"],
    });

    expect(result.system).toContain("Gorky");
    expect(result.system).toContain("REFINE RULES");
    expect(result.system).toContain("sloppy");
    expect(result.system).toContain("concentrated");
    expect(result.system).toContain("260");
  });

  it("includes previous reply and mention in user message", () => {
    const result = buildRefinePrompt({
      previousReply: "Your first answer",
      mentionText: "The claim text",
      thesis: "empty_hype_no_substance",
      relevanceScore: 0.5,
      sentimentIntensity: 0.3,
      expectedKeywords: [],
    });

    expect(result.user).toContain("Your first answer");
    expect(result.user).toContain("The claim text");
    expect(result.user).toContain("empty_hype_no_substance");
  });

  it("includes context when provided", () => {
    const result = buildRefinePrompt({
      previousReply: "X",
      mentionText: "Y",
      context: "Parent tweet context",
      thesis: "social_engagement",
      relevanceScore: 0.2,
      sentimentIntensity: 0.2,
      expectedKeywords: [],
    });

    expect(result.user).toContain("Parent tweet context");
  });

  it("includes thesis supporting point when provided", () => {
    const result = buildRefinePrompt({
      previousReply: "A",
      mentionText: "B",
      thesis: "suspicious_behavior_pattern",
      thesisSupporting: "Same wallet wash trading",
      relevanceScore: 0.8,
      sentimentIntensity: 0.7,
      expectedKeywords: ["wallet"],
    });

    expect(result.user).toContain("Same wallet wash trading");
  });

  it("developer instruction asks for JSON reply", () => {
    const result = buildRefinePrompt({
      previousReply: "x",
      mentionText: "y",
      thesis: "obvious_bait",
      relevanceScore: 0.5,
      sentimentIntensity: 0.4,
      expectedKeywords: [],
    });

    expect(result.developer).toContain('"reply"');
    expect(result.developer).toContain("260");
  });
});
