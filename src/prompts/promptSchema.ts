/**
 * Prompt Schema V1
 *
 * Canonical schema for Gorky image generation prompts.
 * Structured, versioned, and optimized for Replicate/Grok compatibility.
 */

import type { EnergyLevel } from "../brand_matrix/energyInference.js";
import type { StyleBandKey, StyleBandConfig } from "./styleBands.js";

export const PROMPT_SCHEMA_VERSION = "prompt.v1";

/**
 * Main Prompt Schema V1
 */
export type PromptSchemaV1 = {
  version: typeof PROMPT_SCHEMA_VERSION;

  // Immutable identity - always prepended
  persona_signature: string;

  // Selected style band (deterministic)
  style_band: {
    key: StyleBandKey;
    config: StyleBandConfig;
  };

  // Derived from NLP + workflow signals
  content: {
    intent_line: string; // sanitized summary, max 120 chars
    metaphors: string[]; // 2-3 max (from lexicon)
    mood_line: string; // "tone: X, energy: Y/5"
    character_expression: string; // derived from userLevel
  };

  // Output constraints
  constraints: {
    aspect: "1:1" | "16:9" | "3:1";
    no_text: true;
    no_logos: true;
    readability: "high";
  };

  // Negative prompt components (two-stage)
  negative: {
    global: string[]; // always included
    preset?: string[]; // from YAML
    safety?: string[]; // from policy
  };

  // Determinism & trace
  trace: {
    seed?: number; // int32 safe
    model: string; // replicate model slug
    style_band_key: StyleBandKey;
    energy: EnergyLevel;
    user_level: number;
  };
};

/**
 * Input for building a PromptSchemaV1
 */
export type PromptSchemaInput = {
  userIntent: string;
  keywords: string[];
  humorMode: string;
  energy: EnergyLevel;
  aggression: boolean;
  userLevel: number;
  aspect?: "1:1" | "16:9" | "3:1";
  command?: string | null;
  stylePrompt?: string; // from YAML preset
  negativePrompt?: string; // from YAML preset
  model?: string; // replicate model slug (optional for text-only prompts)
  seed?: number;
};

/**
 * Output of prompt building
 */
export type BuiltPrompt = {
  prompt: string;
  negative_prompt: string;
  schema: PromptSchemaV1; // for debugging/caching
};

/**
 * Character Expression mapping based on userLevel
 */
export function getCharacterExpression(userLevel: number): string {
  if (userLevel >= 4) {
    return "ominous smirk, confident (trollish dominance, not scary)";
  }
  if (userLevel >= 2) {
    return "playful grin, smug vibe";
  }
  return "neutral, cheeky";
}

/**
 * Mood line builder
 */
export function buildMoodLine(
  humorMode: string,
  energy: EnergyLevel,
  aggression: boolean
): string {
  const parts: string[] = [`tone: ${humorMode}`, `energy: ${energy}/5`];

  if (aggression) {
    parts.push("de-escalation humor");
  }

  return parts.join(", ");
}

/**
 * Sanitize intent line (max 120 chars, no handles/urls)
 */
export function sanitizeIntentLine(intent: string): string {
  return intent
    .replace(/https?:\/\/\S+/g, "") // remove URLs
    .replace(/@\w+/g, "") // remove handles
    .replace(/#\w+/g, "") // remove hashtags
    .replace(/\s+/g, " ") // normalize whitespace
    .trim()
    .slice(0, 120);
}

/**
 * Parse preset negative prompt (comma-separated string -> array)
 */
export function parsePresetNegative(negativePrompt?: string): string[] {
  if (!negativePrompt) return [];
  return negativePrompt
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Parse safety negative (from policy flags)
 */
export function buildSafetyNegative(flags: string[]): string[] {
  const safetyNegatives: string[] = [];

  for (const flag of flags) {
    if (flag.startsWith("unsafe:")) {
      safetyNegatives.push(flag.replace("unsafe:", ""));
    }
    if (flag === "risky") {
      safetyNegatives.push("controversial content");
    }
  }

  return safetyNegatives;
}
