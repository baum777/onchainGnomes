/**
 * Energy Inference Engine
 *
 * Determines energy level (1-5) based on command context, aggression, and text heuristics.
 * Deterministic output.
 */

export type EnergyLevel = 1 | 2 | 3 | 4 | 5;

export type EnergyInput = {
  explicitEnergy?: number | null;
  command?: string | null;
  aggression?: { isAggressive: boolean; score: number } | null;
  rewardContext?: { isRewardReply?: boolean } | null;
  text?: string | null;
};

function clampEnergy(n: number): EnergyLevel {
  return Math.max(1, Math.min(5, Math.round(n))) as EnergyLevel;
}

function countEmojis(text: string): number {
  const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;
  const matches = text.match(emojiRegex);
  return matches ? matches.length : 0;
}

function countExclamations(text: string): number {
  const matches = text.match(/!/g);
  return matches ? matches.length : 0;
}

export function inferEnergy(input: EnergyInput): EnergyLevel {
  let energy = 3; // default

  // Aggression handling: clamp to 2 if aggressive (rhyme mode handles tone)
  if (input.aggression?.isAggressive) {
    return 2;
  }

  // Reward reply: minimum 4
  if (input.rewardContext?.isRewardReply) {
    energy = Math.max(energy, 4);
  }

  // Command-specific logic
  if (input.command === "remix" && input.explicitEnergy != null) {
    energy = clampEnergy(input.explicitEnergy);
  } else if (input.command === "img") {
    energy = Math.max(energy, 3);
  } else if (input.command === "ask") {
    // ask defaults lower unless other signals boost it
    energy = 2;
  } else if (input.command === "badge" || input.command === "help") {
    energy = 2;
  }

  // Text heuristics
  if (input.text) {
    const text = input.text;
    const emojiCount = countEmojis(text);
    const exclamationCount = countExclamations(text);

    // Lots of emojis/exclamations => +1 energy
    if (emojiCount >= 3 || exclamationCount >= 3) {
      energy = Math.min(5, energy + 1);
    }

    // Question-only or short neutral => -1 energy
    const isQuestionOnly = text.trim().endsWith("?") && text.length < 50;
    const isShortNeutral = text.length < 20 && emojiCount === 0 && exclamationCount === 0;
    if (isQuestionOnly || isShortNeutral) {
      energy = Math.max(1, energy - 1);
    }
  }

  return clampEnergy(energy);
}
