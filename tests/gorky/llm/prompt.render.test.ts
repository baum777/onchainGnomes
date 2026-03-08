/**
 * Phase 5 — Canonical prompt rendering validation.
 *
 * Verifies that buildPrompt + promptToLLMInput produce well-formed prompts:
 * - Selected pattern, narrative label, format target when context provided
 * - Guardrails (rules) included, no financial advice, roast content never identity
 * - No missing variables (undefined) in output strings
 * - No malformed prompt sections
 */

import { describe, it, expect } from "vitest";
import { buildPrompt, promptToLLMInput } from "../../../src/canonical/promptBuilder.js";
import { DEFAULT_CANONICAL_CONFIG } from "../../../src/canonical/types.js";
import type { CanonicalEvent, ThesisBundle, ScoreBundle } from "../../../src/canonical/types.js";

function makeEvent(overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    event_id: "render_1",
    platform: "twitter",
    trigger_type: "mention",
    author_handle: "@testuser",
    author_id: "user_1",
    text: "$SOL mooning 100x gem guaranteed",
    parent_text: null,
    quoted_text: null,
    conversation_context: [],
    cashtags: ["$SOL"],
    hashtags: [],
    urls: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeThesis(): ThesisBundle {
  return {
    primary: "claim_exceeds_evidence",
    supporting_point: "no concrete product proof",
    evidence_bullets: ["contains strong hype language", "no product proof"],
  };
}

function makeScores(overrides: Partial<ScoreBundle> = {}): ScoreBundle {
  return {
    relevance: 0.7,
    confidence: 0.6,
    severity: 0.5,
    opportunity: 0.6,
    risk: 0.2,
    novelty: 0.7,
    ...overrides,
  };
}

describe("canonical prompt rendering", () => {
  it("includes selected pattern, narrative, format when context provided", () => {
    const ctx = {
      pattern_id: "hopium_bust",
      narrative_label: "cycle_narrative",
      format_target: "short_reply",
    };
    const prompt = buildPrompt(
      makeEvent(),
      "analyst_meme_lite",
      makeThesis(),
      makeScores(),
      DEFAULT_CANONICAL_CONFIG,
      ctx,
    );
    const llmInput = promptToLLMInput(prompt);

    expect(llmInput.system).toContain("Selected pattern: hopium_bust");
    expect(llmInput.system).toContain("Narrative: cycle_narrative");
    expect(llmInput.system).toContain("Format: short_reply");
  });

  it("omits optional sections when context not provided", () => {
    const prompt = buildPrompt(
      makeEvent(),
      "dry_one_liner",
      makeThesis(),
      makeScores(),
      DEFAULT_CANONICAL_CONFIG,
    );
    const llmInput = promptToLLMInput(prompt);

    expect(llmInput.system).not.toContain("Selected pattern:");
    expect(llmInput.system).not.toContain("Narrative:");
    expect(llmInput.system).not.toContain("Format:");
  });

  it("includes guardrails (rules) and no financial advice", () => {
    const prompt = buildPrompt(
      makeEvent(),
      "analyst_meme_lite",
      makeThesis(),
      makeScores(),
      DEFAULT_CANONICAL_CONFIG,
    );
    const llmInput = promptToLLMInput(prompt);

    expect(llmInput.system).toMatch(/Rules:/);
    expect(llmInput.system).toContain("No financial advice.");
    expect(llmInput.system).toContain("Roast content, never identity.");
  });

  it("developer section includes JSON and character budget", () => {
    const prompt = buildPrompt(
      makeEvent(),
      "analyst_meme_lite",
      makeThesis(),
      makeScores(),
      DEFAULT_CANONICAL_CONFIG,
    );
    const llmInput = promptToLLMInput(prompt);

    expect(llmInput.developer).toContain("JSON");
    expect(llmInput.developer).toMatch(/Stay under \d+ characters/);
  });

  it("has no undefined or null in output strings", () => {
    const prompt = buildPrompt(
      makeEvent(),
      "dry_one_liner",
      makeThesis(),
      makeScores(),
      DEFAULT_CANONICAL_CONFIG,
    );
    const llmInput = promptToLLMInput(prompt);

    expect(llmInput.system).not.toContain("undefined");
    expect(llmInput.system).not.toContain("null");
    expect(llmInput.developer).not.toContain("undefined");
    expect(llmInput.user).not.toContain("undefined");
    expect(llmInput.user).not.toContain("null");
  });

  it("target text and thesis appear in output", () => {
    const event = makeEvent({ text: "100x guaranteed moon" });
    const prompt = buildPrompt(
      event,
      "analyst_meme_lite",
      makeThesis(),
      makeScores(),
      DEFAULT_CANONICAL_CONFIG,
    );
    const llmInput = promptToLLMInput(prompt);

    expect(llmInput.user).toContain("100x guaranteed moon");
    expect(llmInput.system).toContain("claim_exceeds_evidence");
  });

  it("system is well-formed with no double Rules or empty blocks", () => {
    const prompt = buildPrompt(
      makeEvent(),
      "analyst_meme_lite",
      makeThesis(),
      makeScores(),
      DEFAULT_CANONICAL_CONFIG,
    );
    const llmInput = promptToLLMInput(prompt);

    const rulesMatches = llmInput.system.match(/Rules:/g);
    expect(rulesMatches?.length ?? 0).toBe(1);

    expect(llmInput.system.length).toBeGreaterThan(50);
    expect(llmInput.system).not.toMatch(/\n\n\n+/);
  });
});
