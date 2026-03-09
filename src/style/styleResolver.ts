/**
 * Style Resolver — Horny-Slang Energy Mode Integration
 * 
 * Determines stylistic traits based on energy level and canonical mode.
 * Integrates into: modeSelector → styleResolver → promptBuilder → LLM
 */

import type { CanonicalMode } from "../canonical/types.js";
import type { MarketEnergyLevel } from "./energyDetector.js";
import { getEnergyStyleHints, shouldActivateHornySlang } from "./energyDetector.js";

/** Style context passed to prompt builder */
export interface StyleContext {
  /** Detected market energy level */
  energyLevel: MarketEnergyLevel;
  /** Whether horny_slang_energy is active */
  slangEnabled: boolean;
  /** Style hints for the LLM */
  traitHints: string[];
  /** Slang density level */
  slangDensity: "none" | "low" | "medium" | "high";
  /** Tone descriptor */
  tone: "dry" | "sarcastic" | "playful" | "unhinged";
}

/** Slang categories for horny_slang_energy mode */
export const SLANG_CATEGORIES = {
  /** Heat / Attraction Metaphors */
  heat: [
    "damn this chart hot",
    "this setup looking spicy",
    "chart cooking right now",
    "market looking dangerously attractive",
    "that breakout hot as hell",
    "this narrative getting spicy again",
    "chart looking kinda fine today",
    "this move looking too smooth",
  ],
  /** Flirt / Teasing Market */
  flirt: [
    "market flirting with resistance",
    "ct flirting with this narrative again",
    "chart teasing the breakout",
    "liquidity flirting with chaos",
    "market playing games again",
    "chart acting cute right now",
    "this level getting teased again",
    "market giving mixed signals",
  ],
  /** Crowd Reaction / Applause */
  crowd: [
    "ct gonna clap for this",
    "crowd gonna lose it",
    "people gonna clap if this runs",
    "timeline about to explode",
    "ct about to go crazy",
    "timeline gonna erupt",
    "crowd going wild",
    "everyone cheering this pump",
  ],
  /** Thirsty Liquidity */
  liquidity: [
    "liquidity looking thirsty",
    "market thirsty again",
    "buyers getting hungry",
    "money getting excited",
    "liquidity sniffing a run",
    "capital chasing this move",
    "traders thirsty again",
    "market craving volatility",
  ],
  /** Unhinged Meme Energy */
  unhinged: [
    "ct absolutely unhinged today",
    "timeline going feral",
    "market acting wild",
    "this run getting ridiculous",
    "ct losing its mind again",
    "timeline spiraling",
    "market going full chaos",
    "narrative running loose",
  ],
};

/** All slang phrases combined for random selection */
export const ALL_SLANG_PHRASES = [
  ...SLANG_CATEGORIES.heat,
  ...SLANG_CATEGORIES.flirt,
  ...SLANG_CATEGORIES.crowd,
  ...SLANG_CATEGORIES.liquidity,
  ...SLANG_CATEGORIES.unhinged,
];

/**
 * Resolve style context based on mode and energy level
 */
export function resolveStyle(
  mode: CanonicalMode,
  energyLevel: MarketEnergyLevel,
): StyleContext {
  const slangEnabled = shouldActivateHornySlang(energyLevel);
  const traitHints = getEnergyStyleHints(energyLevel);

  // Determine slang density and tone based on energy
  let slangDensity: StyleContext["slangDensity"] = "none";
  let tone: StyleContext["tone"] = "dry";

  switch (energyLevel) {
    case "LOW":
      slangDensity = "none";
      tone = "dry";
      break;
    case "MEDIUM":
      slangDensity = "low";
      tone = "sarcastic";
      break;
    case "HIGH":
      slangDensity = "medium";
      tone = "playful";
      break;
    case "EXTREME":
      slangDensity = "high";
      tone = "unhinged";
      break;
  }

  // Override for certain modes that should never use slang
  const noSlangModes: CanonicalMode[] = [
    "hard_caution",
    "neutral_clarification",
    "ignore",
  ];

  if (noSlangModes.includes(mode)) {
    return {
      energyLevel,
      slangEnabled: false,
      traitHints: getEnergyStyleHints("LOW"),
      slangDensity: "none",
      tone: "dry",
    };
  }

  return {
    energyLevel,
    slangEnabled,
    traitHints,
    slangDensity,
    tone,
  };
}

/**
 * Get slang guidelines for LLM prompt
 */
export function getSlangGuidelines(): string {
  return `
When slang mode is active, use playful slang and hype language from these categories:

HEAT / ATTRACTION:
- "damn this chart hot", "this setup looking spicy", "chart cooking right now"
- "market looking dangerously attractive", "that breakout hot as hell"

FLIRT / TEASING:
- "market flirting with resistance", "chart teasing the breakout"
- "market playing games again", "this level getting teased again"

CROWD REACTION:
- "ct gonna clap for this", "timeline about to explode"
- "crowd going wild", "everyone cheering this pump"

THIRSTY LIQUIDITY:
- "liquidity looking thirsty", "buyers getting hungry"
- "capital chasing this move", "market craving volatility"

UNHINGED ENERGY (EXTREME only):
- "ct absolutely unhinged today", "timeline going feral"
- "market acting wild", "narrative running loose"

RULES:
- Keep responses 1-2 sentences, short and punchy
- Use slang sparingly but clearly
- NEVER describe explicit sexual acts or anatomy
- NEVER use pornographic language
- Focus on market behavior, narratives, and CT reactions
- Maintain humor and sarcasm native to crypto twitter
`.trim();
}

/**
 * Check if a mode supports stylistic variation
 */
export function modeSupportsStyling(mode: CanonicalMode): boolean {
  const stylingModes: CanonicalMode[] = [
    "dry_one_liner",
    "analyst_meme_lite",
    "skeptical_breakdown",
    "market_banter",
    "social_banter",
    "conversation_hook",
  ];
  return stylingModes.includes(mode);
}

/**
 * Get sample phrases for the current energy level
 */
export function getSamplePhrases(energyLevel: MarketEnergyLevel): string[] {
  switch (energyLevel) {
    case "HIGH":
      return [
        ...SLANG_CATEGORIES.heat.slice(0, 3),
        ...SLANG_CATEGORIES.flirt.slice(0, 2),
        ...SLANG_CATEGORIES.liquidity.slice(0, 2),
      ];
    case "EXTREME":
      return [
        ...SLANG_CATEGORIES.crowd.slice(0, 2),
        ...SLANG_CATEGORIES.unhinged.slice(0, 3),
        ...SLANG_CATEGORIES.heat.slice(0, 2),
      ];
    default:
      return [];
  }
}
