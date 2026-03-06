/**
 * CLI Prompt Bridge — Generates canonical prompts from terminal input.
 * Used by the Python CLI to reuse the production prompt pipeline.
 * Outputs JSON: { skip, reason?, system?, developer?, user?, mode? }
 */

import type { CanonicalEvent } from "../src/canonical/types.js";
import { DEFAULT_CANONICAL_CONFIG } from "../src/canonical/types.js";
import { classify } from "../src/canonical/classifier.js";
import { scoreEvent } from "../src/canonical/scorer.js";
import { checkEligibility } from "../src/canonical/eligibility.js";
import { extractThesis } from "../src/canonical/thesisExtractor.js";
import { selectMode } from "../src/canonical/modeSelector.js";
import { buildPrompt, promptToLLMInput } from "../src/canonical/promptBuilder.js";

function extractCashtags(text: string): string[] {
  const matches = text.match(/\$([A-Za-z0-9]{1,15})\b/g);
  return matches ? [...new Set(matches.map((m) => m.slice(1).toUpperCase()))] : [];
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#(\w+)/g);
  return matches ? [...new Set(matches.map((m) => m.slice(1)))] : [];
}

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s]+/g);
  return matches ?? [];
}

function createMinimalEvent(userInput: string): CanonicalEvent {
  const now = new Date().toISOString();
  return {
    event_id: `cli_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    platform: "twitter",
    trigger_type: "mention",
    author_handle: "terminal_user",
    author_id: "cli_terminal",
    text: userInput.trim(),
    parent_text: null,
    quoted_text: null,
    conversation_context: [],
    cashtags: extractCashtags(userInput),
    hashtags: extractHashtags(userInput),
    urls: extractUrls(userInput),
    timestamp: now,
  };
}

function main(): void {
  const userInput = process.argv[2] ?? "";
  if (!userInput.trim()) {
    console.error(JSON.stringify({ skip: true, reason: "skip_invalid_input" }));
    process.exit(1);
  }

  const config = DEFAULT_CANONICAL_CONFIG;
  const event = createMinimalEvent(userInput);

  const cls = classify(event);

  if (cls.policy_severity === "hard" || (cls.policy_blocked && !cls.policy_severity)) {
    console.log(JSON.stringify({ skip: true, reason: "skip_policy" }));
    return;
  }

  const scores = scoreEvent(event, cls);
  const eligibility = checkEligibility(scores, cls, config);
  if (!eligibility.eligible) {
    console.log(JSON.stringify({ skip: true, reason: eligibility.skip_reason ?? "skip_low_relevance" }));
    return;
  }

  const thesis = extractThesis(event, cls, scores);
  if (!thesis) {
    console.log(JSON.stringify({ skip: true, reason: "skip_no_thesis" }));
    return;
  }

  const mode = selectMode(cls, scores, thesis, config);
  if (mode === "ignore") {
    console.log(JSON.stringify({ skip: true, reason: "skip_low_confidence" }));
    return;
  }

  const prompt = buildPrompt(event, mode, thesis, scores, config);
  const llmInput = promptToLLMInput(prompt);

  console.log(
    JSON.stringify({
      skip: false,
      mode,
      system: llmInput.system,
      developer: llmInput.developer,
      user: llmInput.user,
    })
  );
}

main();
