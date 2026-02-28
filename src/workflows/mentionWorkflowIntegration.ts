/**
 * Mention Workflow Integration Example
 *
 * This file demonstrates how to integrate the four new modules:
 * - detectAggression
 * - inferEnergy
 * - selectHumorMode
 * - composeGorkyPrompt
 *
 * Usage in mentionWorkflow.ts:
 */

import { detectAggression } from "../safety/aggressionDetector.js";
import { inferEnergy } from "../brand_matrix/energyInference.js";
import { selectHumorMode } from "../brand_matrix/humorModeSelector.js";
import { composeGorkyPrompt } from "../brand_matrix/gorkyPromptComposer.js";

// Example input types (from existing workflow)
type MentionEvent = {
  tweet_id: string;
  user_id: string;
  user_handle: string;
  text: string;
};

type UserProfile = {
  reward_pending: boolean;
  last_image_reward_at?: string;
};

/**
 * Integration function showing how to wire all 4 modules
 * This should be called within the mention workflow before LLM generation
 */
export function prepareGorkyResponse(
  event: MentionEvent,
  profile: UserProfile,
  command: string | null,
  explicitEnergy?: number | null
) {
  // Step 1: Detect aggression
  const aggressionSignal = detectAggression({ text: event.text });

  // Step 2: Infer energy level
  const energy = inferEnergy({
    explicitEnergy,
    command,
    aggression: aggressionSignal,
    rewardContext: { isRewardReply: profile.reward_pending },
    text: event.text,
  });

  // Step 3: Select humor mode
  const humorMode = selectHumorMode({
    energy,
    aggression: { isAggressive: aggressionSignal.isAggressive },
    command,
    isRewardReply: profile.reward_pending,
  });

  // Step 4: Compose the prompt
  const prompt = composeGorkyPrompt({
    userText: event.text,
    command,
    energy,
    humorMode,
    isRewardReply: profile.reward_pending,
    context: {
      summary: `Replying to @${event.user_handle}`,
    },
  });

  // Return everything needed for LLM call
  return {
    aggressionSignal,
    energy,
    humorMode,
    prompt,
    shouldUseRhyme: aggressionSignal.isAggressive,
    isSafeToReply: !aggressionSignal.isAggressive || humorMode === "rhyme",
  };
}

/**
 * Example usage in mentionWorkflow process method:
 *
 * async process(event: MentionEvent, profile: UserProfile) {
 *   // ... existing idempotency and safety checks ...
 *
 *   const preparation = prepareGorkyResponse(
 *     event,
 *     profile,
 *     parsed.command,
 *     parsed.args.energy
 *   );
 *
 *   // If aggressive, rhyme mode de-escalates
 *   if (preparation.shouldUseRhyme) {
 *     console.log("Using rhyme de-escalation mode");
 *   }
 *
 *   // Call LLM with composed prompt
 *   const llmResponse = await this.llmClient.generate({
 *     system: preparation.prompt.system,
 *     user: preparation.prompt.user,
 *   });
 *
 *   // Validate output safety
 *   assertPublicSafe(llmResponse, { route: "/mention" });
 *
 *   return {
 *     success: true,
 *     mode: "TEXT",
 *     reply_text: llmResponse,
 *   };
 * }
 */
