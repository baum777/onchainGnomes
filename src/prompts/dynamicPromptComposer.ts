/**
 * Dynamic Prompt Composer (Refactored - Phase 3)
 *
 * Uses the new PromptSchemaV1 system with:
 * - StyleBands (6 defined modes)
 * - TopicLexikon (45 keywords -> metaphors)
 * - Two-stage negative prompts
 * - Deterministic persona signature
 */

import type { EnergyLevel } from "../brand_matrix/energyInference.js";
import type { PromptSchemaInput, BuiltPrompt } from "./promptSchema.js";
import { composePrompt, composeCompactPrompt } from "./buildPromptFromSchema.js";

// Re-export types for convenience
export type { BuiltPrompt, PromptSchemaInput };

/**
 * Legacy context type (for backward compatibility)
 * @deprecated Use PromptSchemaInput instead
 */
export type DynamicPromptContext = {
  userIntent: string;
  keywords: string[];
  humorMode: string;
  energy: EnergyLevel;
  aggression: boolean;
  stylePrompt?: string;
  negativePrompt?: string;
  userLevel: number;
  aspect?: "1:1" | "16:9" | "3:1";
  command?: string | null;
};

/**
 * Composed prompt result (legacy interface)
 */
export type ComposedPrompt = {
  prompt: string;
  negative_prompt: string;
};

/**
 * NEW: Primary prompt composition function
 * Uses the Schema V1 system internally
 */
export function composeDynamicPrompt(
  input: PromptSchemaInput,
  options?: { compact?: boolean }
): BuiltPrompt {
  if (options?.compact) {
    return composeCompactPrompt(input);
  }
  return composePrompt(input);
}

/**
 * NEW: Build prompt with safety flags included
 * For use in the workflow where safety assessment is available
 */
export function composePromptWithSafety(
  input: PromptSchemaInput,
  safetyFlags: string[]
): BuiltPrompt {
  // Build the schema first
  const { buildPromptSchema } = require("./buildPromptFromSchema.js");
  const schema = buildPromptSchema(input);

  // Add safety flags to negative
  schema.negative.safety = safetyFlags;

  // Build final prompt
  const { buildPromptFromSchema } = require("./buildPromptFromSchema.js");
  return buildPromptFromSchema(schema);
}

/**
 * LEGACY: Backward-compatible wrapper
 * @deprecated Use composeDynamicPrompt with PromptSchemaInput
 */
export function composeReplyText(ctx: DynamicPromptContext): ComposedPrompt {
  // Convert legacy context to new schema input
  const input: PromptSchemaInput = {
    userIntent: ctx.userIntent,
    keywords: ctx.keywords,
    humorMode: ctx.humorMode,
    energy: ctx.energy,
    aggression: ctx.aggression,
    userLevel: ctx.userLevel,
    aspect: ctx.aspect ?? "1:1",
    command: ctx.command,
    stylePrompt: ctx.stylePrompt,
    negativePrompt: ctx.negativePrompt,
    model: "default", // not used for text prompts
  };

  const result = composePrompt(input);

  return {
    prompt: result.prompt,
    negative_prompt: result.negative_prompt,
  };
}

/**
 * Helper: Create schema input from workflow context
 * For use in mentionWorkflow.ts handleImageBranch
 */
export function createPromptInputFromContext(ctx: {
  eventText: string;
  keywords: string[];
  humorMode: string;
  energy: EnergyLevel;
  aggression: boolean;
  userLevel: number;
  preset?: { style_prompt?: string; negative_prompt?: string };
  command?: string | null;
  model: string;
  seed?: number;
  aspect?: "1:1" | "16:9" | "3:1";
}): PromptSchemaInput {
  return {
    userIntent: ctx.eventText,
    keywords: ctx.keywords,
    humorMode: ctx.humorMode,
    energy: ctx.energy,
    aggression: ctx.aggression,
    userLevel: ctx.userLevel,
    aspect: ctx.aspect ?? "1:1",
    command: ctx.command,
    stylePrompt: ctx.preset?.style_prompt,
    negativePrompt: ctx.preset?.negative_prompt,
    model: ctx.model,
    seed: ctx.seed,
  };
}

// Re-export the new system for direct use
export {
  composePrompt,
  composeCompactPrompt,
} from "./buildPromptFromSchema.js";

export {
  selectStyleBand,
  getStyleBandSelectionReason,
} from "./selectStyleBand.js";

export {
  getMetaphor,
  mapKeywordsToMetaphors,
  combineMetaphors,
} from "./topicLexicon.js";

export {
  getStyleBand,
  PERSONA_SIGNATURE,
  GLOBAL_NEGATIVE_GUARDS,
} from "./styleBands.js";

export {
  composeNegativePrompt,
  getNegativePromptStages,
} from "./negativePromptComposer.js";
