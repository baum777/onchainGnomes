/**
 * StyleBands System
 *
 * 6 definierte visuelle Modi für Gorky Image Prompts.
 * Jeder Band hat ein Core-Style-Prompt und Composition-Defaults.
 * Deterministische Selektion basierend auf Energy, Level, Command, Aggression.
 */

export type StyleBandKey =
  | "GORKY_BLUEPRINT_MINIMAL"
  | "GORKY_NEON_CHALK"
  | "GORKY_CYBER_GLITCH"
  | "GORKY_MEME_CARD_CLEAN"
  | "GORKY_DOMINANCE_MODE"
  | "GORKY_SHADOW_IRONY";

export type StyleBandConfig = {
  key: StyleBandKey;
  core: string;
  composition_defaults: string;
  energy_range: [number, number]; // min, max (inclusive)
};

// Constant Persona Signature - immer prependen
export const PERSONA_SIGNATURE = `Gorky, mischievous sarcastic crypto troll spirit.
Neon chalk doodle aesthetic. High contrast, clean silhouette, strong visual readability.
No readable text, no logos, no watermark.`;

// Global Guards - immer in negative_prompt
export const GLOBAL_NEGATIVE_GUARDS = [
  "realistic human faces",
  "gore",
  "violence",
  "explicit sexual content",
  "slurs",
  "hate symbols",
  "logos",
  "watermark",
  "readable text",
  "photorealism",
  "overly detailed backgrounds",
];

// Default Metaphoren wenn keine Keywords matchen
export const DEFAULT_METAPHORS = [
  "broken candlestick charts",
  "floating arrows",
  "chaotic scribble symbols",
];

// Die 6 StyleBands
export const STYLE_BANDS: Record<StyleBandKey, StyleBandConfig> = {
  // Band 1: Energy 0-1, Calm Strategic Power
  GORKY_BLUEPRINT_MINIMAL: {
    key: "GORKY_BLUEPRINT_MINIMAL",
    core: `minimal geometric composition, blueprint style lines,
deep navy background, subtle cyan highlights,
controlled structure, architectural balance,
low chaos, restrained visual noise`,
    composition_defaults: "1:1 or 16:9, high negative space, subject centered or slightly right",
    energy_range: [0, 1],
  },

  // Band 2: Energy 2-3, Default, Playful Sarcastic
  GORKY_NEON_CHALK: {
    key: "GORKY_NEON_CHALK",
    core: `neon chalk doodle on black background,
glowing yellow outlines, soft neon glow,
hand-drawn imperfect lines, playful chaos energy`,
    composition_defaults: "1:1, subject slightly right of center, medium negative space",
    energy_range: [2, 3],
  },

  // Band 3: Energy 4-5, High Chaos / Dominance
  GORKY_CYBER_GLITCH: {
    key: "GORKY_CYBER_GLITCH",
    core: `glitch cyberpunk aesthetic, distorted trading screens,
fragmented UI shards, electric neon accents,
dynamic diagonal energy lines, high contrast dramatic lighting`,
    composition_defaults: "1:1 or 16:9, aggressive diagonals, lower negative space",
    energy_range: [4, 5],
  },

  // Band 4: Command /img, Meme Structure
  GORKY_MEME_CARD_CLEAN: {
    key: "GORKY_MEME_CARD_CLEAN",
    core: `clean meme card layout, clear subject focus,
strong silhouette, minimal background noise, flat neon accents`,
    composition_defaults: "1:1, subject centered, strong framing",
    energy_range: [0, 5], // command-driven, not energy
  },

  // Band 5: User Level >= 4, Controlled Superiority
  GORKY_DOMINANCE_MODE: {
    key: "GORKY_DOMINANCE_MODE",
    core: `Gorky larger than chart, subtle ominous presence,
calm dominant stance, glowing outline against chaotic market backdrop,
clear hierarchy of elements`,
    composition_defaults: "subject foreground, chart secondary, strong depth separation",
    energy_range: [0, 5], // level-driven, not energy
  },

  // Band 6: Aggression detected, De-escalation through humor
  GORKY_SHADOW_IRONY: {
    key: "GORKY_SHADOW_IRONY",
    core: `soft neon glow, reduced intensity, ironic detached expression,
visual metaphor emphasized over aggression,
balanced contrast, not threatening`,
    composition_defaults: "medium negative space, stable framing, less distortion",
    energy_range: [0, 5], // aggression-driven
  },
};

/**
 * Get StyleBand by key
 */
export function getStyleBand(key: StyleBandKey): StyleBandConfig {
  return STYLE_BANDS[key];
}

/**
 * Get all available StyleBand keys
 */
export function getAllStyleBandKeys(): StyleBandKey[] {
  return Object.keys(STYLE_BANDS) as StyleBandKey[];
}
