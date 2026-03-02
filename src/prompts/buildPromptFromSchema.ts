/**
 * Build Prompt From Schema
 *
 * Canonical prompt builder that converts PromptSchemaV1
 * into the final prompt + negative_prompt strings for Replicate.
 */

import type {
  PromptSchemaV1,
  BuiltPrompt,
  PromptSchemaInput,
} from "./promptSchema.js";
import {
  PERSONA_SIGNATURE,
  GLOBAL_NEGATIVE_GUARDS,
  getStyleBand,
} from "./styleBands.js";
import {
  getCharacterExpression,
  buildMoodLine,
  sanitizeIntentLine,
  parsePresetNegative,
  PROMPT_SCHEMA_VERSION,
} from "./promptSchema.js";
import { mapKeywordsToMetaphors, DEFAULT_METAPHORS } from "./topicLexicon.js";
import { selectStyleBand } from "./selectStyleBand.js";

/**
 * Build complete prompt schema from input
 */
export function buildPromptSchema(input: PromptSchemaInput): PromptSchemaV1 {
  // Select style band deterministically
  const styleBandKey = selectStyleBand({
    energy: input.energy,
    userLevel: input.userLevel,
    aggression: input.aggression,
    command: input.command,
  });

  const styleBand = getStyleBand(styleBandKey);

  // Map keywords to metaphors
  const metaphors = mapKeywordsToMetaphors(input.keywords, 3);

  // Build content
  const content: PromptSchemaV1["content"] = {
    intent_line: sanitizeIntentLine(input.userIntent),
    metaphors: metaphors.length > 0 ? metaphors : DEFAULT_METAPHORS,
    mood_line: buildMoodLine(input.humorMode, input.energy, input.aggression),
    character_expression: getCharacterExpression(input.userLevel),
  };

  // Build negative (two-stage: global + preset + safety)
  const negative: PromptSchemaV1["negative"] = {
    global: GLOBAL_NEGATIVE_GUARDS,
    preset: parsePresetNegative(input.negativePrompt),
    safety: [], // populated by caller if needed
  };

  // Constraints
  const constraints: PromptSchemaV1["constraints"] = {
    aspect: input.aspect ?? "1:1",
    no_text: true,
    no_logos: true,
    readability: "high",
  };

  // Trace
  const trace: PromptSchemaV1["trace"] = {
    seed: input.seed,
    model: input.model ?? "unknown",
    style_band_key: styleBandKey,
    energy: input.energy,
    user_level: input.userLevel,
  };

  return {
    version: PROMPT_SCHEMA_VERSION,
    persona_signature: PERSONA_SIGNATURE,
    style_band: {
      key: styleBandKey,
      config: styleBand,
    },
    content,
    constraints,
    negative,
    trace,
  };
}

/**
 * Build final prompt strings from schema
 */
export function buildPromptFromSchema(schema: PromptSchemaV1): BuiltPrompt {
  // Combine metaphors
  const metaphorsCombined = schema.content.metaphors.join("; ");

  // Build canonical prompt (4 blocks)
  const promptBlocks: string[] = [
    // Block 1: Persona Signature
    schema.persona_signature.trim(),

    // Block 2: Style Band Core
    schema.style_band.config.core.trim(),

    // Block 3: Content
    `Scene: ${schema.content.intent_line}`,
    `Mood: ${schema.content.mood_line}`,
    `Gorky: ${schema.content.character_expression}`,

    // Block 4: Metaphors & Composition
    `Include: ${metaphorsCombined}`,
    `Composition: ${schema.constraints.aspect} | ${schema.style_band.config.composition_defaults} | high readability | clean silhouette`,
  ];

  // Combine with double newlines for clarity
  const prompt = promptBlocks.filter(Boolean).join("\n\n");

  // Build negative prompt (two-stage: global + preset + safety)
  const negativeParts: string[] = [
    ...schema.negative.global,
    ...(schema.negative.preset ?? []),
    ...(schema.negative.safety ?? []),
  ];

  const negative_prompt = negativeParts.filter(Boolean).join(", ");

  return {
    prompt,
    negative_prompt,
    schema,
  };
}

/**
 * High-level convenience function
 * Input -> Schema -> Built Prompt
 */
export function composePrompt(input: PromptSchemaInput): BuiltPrompt {
  const schema = buildPromptSchema(input);
  return buildPromptFromSchema(schema);
}

/**
 * Ultra-compact variant (token-saver)
 * Same semantics, fewer tokens
 */
export function composeCompactPrompt(input: PromptSchemaInput): BuiltPrompt {
  const schema = buildPromptSchema(input);

  // Shorter format
  const prompt = [
    "Gorky sarcastic crypto troll, neon chalk doodle, high contrast, clean silhouette. No text/logos.",
    `Style: ${schema.style_band.config.core.split("\n")[0]?.trim()}`,
    `Scene: ${schema.content.intent_line}. Mood: ${schema.content.mood_line}. Gorky: ${schema.content.character_expression}.`,
    `Include: ${schema.content.metaphors.join("; ")}.`,
    `Comp: ${schema.constraints.aspect}, ${schema.style_band.config.composition_defaults.split(",")[0]?.trim()}, readable.`,
  ].join("\n");

  const negativeParts: string[] = [
    ...schema.negative.global,
    ...(schema.negative.preset ?? []),
    ...(schema.negative.safety ?? []),
  ];

  return {
    prompt,
    negative_prompt: negativeParts.filter(Boolean).join(", "),
    schema,
  };
}
