/**
 * Humor Mode Selector
 *
 * Deterministically selects humor mode based on energy, aggression, and context.
 * Uses rollDice (event_id seeded) when provided for reproducible variation.
 */

import type { Dice } from "../utils/rollDice.js";
import { EnergyLevel } from "./energyInference.js";

export type HumorMode = "authority" | "scientist" | "therapist" | "reality" | "goblin" | "rhyme";

export type HumorModeInput = {
  energy: EnergyLevel;
  aggression: { isAggressive: boolean };
  command?: string | null;
  isRewardReply?: boolean;
  dice?: Dice | null;
};

// Simple deterministic hash function (FNV-1a inspired)
function hashString(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0; // Convert to unsigned 32-bit
}

// Seeded RNG using mulberry32 algorithm
function mulberry32(seed: number): () => number {
  return function() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createSeedFromInput(input: HumorModeInput): number {
  const seedStr = `${input.command || ""}:${input.energy}:${input.isRewardReply ? 1 : 0}`;
  return hashString(seedStr);
}

function getRng(input: HumorModeInput): () => number {
  if (input.dice) {
    return () => input.dice!.float();
  }
  return mulberry32(createSeedFromInput(input));
}

export function selectHumorMode(input: HumorModeInput): HumorMode {
  // Aggression always triggers rhyme mode (RHYME_DEESCALATION)
  if (input.aggression.isAggressive) {
    return "rhyme";
  }

  const { energy } = input;
  const rng = getRng(input);

  // Energy-based selection with deterministic variation
  switch (energy) {
    case 1:
    case 2: {
      // 50/50 split between therapist and authority
      return rng() < 0.5 ? "therapist" : "authority";
    }

    case 3: {
      // Default authority, scientist if remix or reward reply
      if (input.command === "remix" || input.isRewardReply) {
        return "scientist";
      }
      return "authority";
    }

    case 4: {
      // Default scientist, sometimes goblin (15%) or reality (15%)
      const x = rng();
      if (x < 0.15) return "goblin";
      if (x < 0.3) return "reality";
      return "scientist";
    }

    case 5: {
      // Default goblin, sometimes authority (20% chance, deterministic)
      return rng() < 0.2 ? "authority" : "goblin";
    }

    default:
      return "authority";
  }
}

// Convenience exports for specific use cases
export function selectModeForRemix(energy: EnergyLevel, flavor?: string): HumorMode {
  return selectHumorMode({
    energy,
    aggression: { isAggressive: false },
    command: "remix",
  });
}

export function selectModeForMention(
  energy: EnergyLevel,
  aggressionFlag: boolean,
  isRewardReply?: boolean
): HumorMode {
  return selectHumorMode({
    energy,
    aggression: { isAggressive: aggressionFlag },
    isRewardReply,
  });
}
