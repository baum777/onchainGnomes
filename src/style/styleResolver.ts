/**
 * Style Resolver — Horny-Slang Energy Mode Integration
 *
 * Determines stylistic traits based on energy level and canonical mode.
 * Integrates into: modeSelector → styleResolver → promptBuilder → LLM
 */

import type { CanonicalMode, ScoreBundle, ThesisBundle } from "../canonical/types.js";
import type { MarketEnergyLevel } from "./energyDetector.js";
import { getEnergyStyleHints, shouldActivateHornySlang } from "./energyDetector.js";

/** Style context passed to prompt builder */
export interface StyleContext {
  /** Detected market energy level */
  energyLevel: MarketEnergyLevel;
  /** Whether horny_slang_energy is active */
  slangEnabled: boolean;
  /** Whether savage_horny_slang is active (EXTREME + bissigkeit >= 8) */
  savage_horny_slang: boolean;
  /** Whether ultra_savage is active (EXTREME + bissigkeit > 9.2) */
  ultra_savage: boolean;
  /** Whether degen_regard is active (chaotic meme-coin, low relevance, bissigkeit 6.5-8.7) */
  degen_regard: boolean;
  /** Style hints for the LLM */
  traitHints: string[];
  /** Slang density level */
  slangDensity: "none" | "low" | "medium" | "high";
  /** Tone descriptor */
  tone: "dry" | "sarcastic" | "playful" | "unhinged";
}

const BISSIGKEIT_FALLBACK = 5.0;

/**
 * Hybrid bissigkeit: heuristic with optional LLM score.
 * Severity, opportunity, risk: 0-1 (ScoreBundle). Relevance: 0-1.
 */
export function calculateHybridBissigkeit(
  llmScore: number | null,
  severity: number,
  opportunity: number,
  risk: number,
  relevance: number,
): number {
  const s = severity ?? 0;
  const o = opportunity ?? 0;
  const r = risk ?? 0;
  const rel = relevance ?? 0.5;
  const heuristic =
    (s * 4.5 + o * 3 + r * 2.5) * (1 + (rel - 0.5) * 0.8);
  const base = llmScore != null ? Math.max(llmScore, heuristic) : heuristic;
  return Math.min(10, Math.max(1, base));
}

/**
 * Estimate bissigkeit proxy from scores/thesis before LLM call.
 * Uses hybrid heuristic with relevance boost.
 */
export function estimateBissigkeitProxy(
  scores: ScoreBundle,
  _thesis?: ThesisBundle,
  relevance?: number,
): number {
  const raw = calculateHybridBissigkeit(
    null,
    scores.severity ?? 0,
    scores.opportunity ?? 0,
    scores.risk ?? 0,
    relevance ?? scores.relevance ?? 0.5,
  );
  return Math.max(BISSIGKEIT_FALLBACK, raw);
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

/** Optional inputs for degen_regard activation */
export interface DegenRegardInput {
  relevance_score?: number;
  keyword_density?: number;
  is_meme_coin_event?: boolean;
}

/**
 * Resolve style context based on mode, energy level and bissigkeit
 */
export function resolveStyle(
  mode: CanonicalMode,
  energyLevel: MarketEnergyLevel,
  bissigkeit?: number,
  degenInput?: DegenRegardInput,
): StyleContext {
  const b = bissigkeit ?? BISSIGKEIT_FALLBACK;
  const slangEnabled = shouldActivateHornySlang(energyLevel);
  const savage_horny_slang =
    energyLevel === "EXTREME" && slangEnabled && b >= 8;
  const ultra_savage =
    energyLevel === "EXTREME" && slangEnabled && b > 9.2;

  const relevance_score = degenInput?.relevance_score ?? 0.75;
  const keyword_density = degenInput?.keyword_density ?? 0;
  const is_meme_coin_event = degenInput?.is_meme_coin_event ?? false;
  const degen_regard =
    (energyLevel === "HIGH" || energyLevel === "EXTREME") &&
    (relevance_score < 0.75 || keyword_density > 3.0 || is_meme_coin_event) &&
    b >= 6.5 &&
    b <= 8.7;

  console.debug(
    `Style → horny: ${slangEnabled}, savage: ${savage_horny_slang}, ultra: ${ultra_savage}, degen: ${degen_regard}, energy: ${energyLevel}, bissigkeit: ${b}`,
  );

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
      savage_horny_slang: false,
      ultra_savage: false,
      degen_regard: false,
      traitHints: getEnergyStyleHints("LOW"),
      slangDensity: "none",
      tone: "dry",
    };
  }

  return {
    energyLevel,
    slangEnabled,
    savage_horny_slang,
    ultra_savage,
    degen_regard,
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
 * Savage horny-slang guidelines (EXTREME + bissigkeit >= 8)
 */
export function getSavageSlangGuidelines(): string {
  return `
=== SAVAGE HORNY-SLANG ACTIVE (bissigkeit_score >=8 + EXTREME) ===
Make it extra brutal and savage while keeping the horny slang metaphors.
Use intensifiers: "as fuck", "af", "sniffing blood", "losing their minds", "panic selling incoming".

Examples (use 1-2 per reply):
- damn this chart hot as fuck and ct is thirsty af
- this breakout smooth as hell — market flirting hard and crowd losing their minds
- liquidity sniffing blood, timeline about to go feral
- chart looking dangerously fine rn, ct gonna clap and then panic
- narrative cooking with gas — everyone thirsty and unhinged

Keep it humorous, meme-driven, platform-safe. No slurs, no explicit content.
`.trim();
}

/**
 * Ultra-savage guidelines (EXTREME + bissigkeit > 9.2)
 */
export function getUltraSavageGuidelines(): string {
  return `
=== ULTRA-SAVAGE MODE (bissigkeit >9.2) ===
Go nuclear: use "nuked", "rekt", "bloodbath", "sniffing blood", "timeline feral af".

Examples (use 1-2 per reply):
Heat: this chart is straight-up nuked levels of hot, setup so spicy it's giving third-degree burns af
Flirt: market teasing like a dommy mommy, chart playing hard to get then folds
Crowd: ct about to nut then get rekt, apes clapping cheeks while panic-selling
Thirsty: liquidity thirstier than incel in bear, bids begging for green d
Unhinged: timeline full rabies mode feral af, ct spiraling harder than leveraged degen on bloodbath

Platform-safe: no slurs, no explicit content. Humor and meme energy only.
`.trim();
}

/**
 * Degen/Regard guidelines (chaotic meme-coin, bissigkeit 6.5-8.7)
 */
export function getDegenRegardGuidelines(): string {
  return `
=== DEGEN / REGARD MODE ACTIVE ===
Full chaotic degen energy. Self-deprecating gambling vibes.
Heavy use of: ngmi, ape in, regarded, smooth brain, jeet, lfg, cooked, impulse buy.
Keep it short, hectic, ironic. We're all in this stupid together.

Examples (use 1-3 per reply):
- this shitcoin so regarded even my regarded ass is apeing in
- ngmi gang where you at — we eating ramen together after this rug
- chart looking like my impulse control: straight to zero in 4k
- lfg or ngmi, no in-between — wallet already crying
- ct full degen hours, someone hide my seed phrase
- smooth brain activated, buying the top like a true regard
- this pump so chaotic im regarded and horny at the same time
- leverage gang rise up — 100x or food stamps, pick one
- narrative so regarded it's basically performance art
- we all gonna get rekt but at least it'll be cinematic

Rules: Always self-deprecating or collectively regarded. Short, hectic, sporadic caps. Platform-safe.
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
