/**
 * StyleBand Selector
 *
 * Deterministische Logik zur Auswahl des richtigen StyleBands
 * basierend auf Energy, User Level, Command und Aggression.
 */

import type { StyleBandKey } from "./styleBands.js";

export type StyleBandSelectionContext = {
  energy: number; // 1-5
  userLevel: number; // 0-5
  aggression: boolean;
  command?: string | null;
};

/**
 * Select StyleBand based on context
 * Deterministisch - keine Randomness
 *
 * Priority Order:
 * 1. Command /img -> MEME_CARD_CLEAN
 * 2. Aggression detected -> SHADOW_IRONY
 * 3. User Level >= 4 -> DOMINANCE_MODE
 * 4. Energy 4-5 -> CYBER_GLITCH
 * 5. Energy 0-1 -> BLUEPRINT_MINIMAL
 * 6. Default -> NEON_CHALK
 */
export function selectStyleBand(ctx: StyleBandSelectionContext): StyleBandKey {
  // Priority 1: Explicit image command
  if (ctx.command === "img") {
    return "GORKY_MEME_CARD_CLEAN";
  }

  // Priority 2: Aggression de-escalation
  if (ctx.aggression) {
    return "GORKY_SHADOW_IRONY";
  }

  // Priority 3: High level users get dominance mode
  if (ctx.userLevel >= 4) {
    return "GORKY_DOMINANCE_MODE";
  }

  // Priority 4: High energy -> cyber glitch
  if (ctx.energy >= 4) {
    return "GORKY_CYBER_GLITCH";
  }

  // Priority 5: Low energy -> blueprint minimal
  if (ctx.energy <= 1) {
    return "GORKY_BLUEPRINT_MINIMAL";
  }

  // Default: Neon chalk (balanced, playful)
  return "GORKY_NEON_CHALK";
}

/**
 * Extended selector with more granular control
 * For future use when we need more nuanced selection
 */
export function selectStyleBandExtended(ctx: {
  energy: number;
  userLevel: number;
  aggression: boolean;
  command?: string | null;
  isRewardImage?: boolean;
  isFirstInteraction?: boolean;
}): StyleBandKey {
  // First interaction with new users - keep it light
  if (ctx.isFirstInteraction && ctx.userLevel === 0) {
    return "GORKY_BLUEPRINT_MINIMAL";
  }

  // Reward images for high-level users
  if (ctx.isRewardImage && ctx.userLevel >= 4) {
    return "GORKY_DOMINANCE_MODE";
  }

  // Standard selection
  return selectStyleBand({
    energy: ctx.energy,
    userLevel: ctx.userLevel,
    aggression: ctx.aggression,
    command: ctx.command,
  });
}

/**
 * Get a human-readable reason for the selection
 * Useful for logging/debugging
 */
export function getStyleBandSelectionReason(
  ctx: StyleBandSelectionContext,
  selectedBand: StyleBandKey
): string {
  const reasons: Record<StyleBandKey, string> = {
    GORKY_MEME_CARD_CLEAN: "explicit /img command",
    GORKY_SHADOW_IRONY: "aggression detected - de-escalation mode",
    GORKY_DOMINANCE_MODE: `high level user (${ctx.userLevel})`,
    GORKY_CYBER_GLITCH: `high energy (${ctx.energy})`,
    GORKY_BLUEPRINT_MINIMAL: `low energy (${ctx.energy})`,
    GORKY_NEON_CHALK: `balanced energy (${ctx.energy}) - default`,
  };

  return reasons[selectedBand] ?? "default selection";
}
