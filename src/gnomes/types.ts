/**
 * Gnome types — Character profile definitions for multi-persona ensemble
 *
 * Each gnome represents a distinct character with tone, traits, routing hints,
 * and memory rules. GORKY maps to gnome id "gorky".
 */

/** Archetype for routing and trait grouping */
export type GnomeArchetype =
  | "chaos_roaster"
  | "dry_observer"
  | "chaotic_reactor"
  | "skeptical_builder"
  | "playful_teaser"
  | "ash_priest";

/** Voice traits for prompt composition */
export interface VoiceTraits {
  /** Sarcasm level 0–10 */
  sarcasm?: number;
  /** Meme density tendency 0–10 */
  meme_density?: number;
  /** Warmth/humanness 0–10 */
  warmth?: number;
  /** Theatricality 0–10 */
  theatricality?: number;
  /** Dryness/detachment 0–10 */
  dryness?: number;
}

/** Language preferences */
export interface LanguagePrefs {
  primary?: string;
  allow_slang?: boolean;
  preferred_keywords?: string[];
}

/** Routing hints for gnome selection */
export interface RoutingHints {
  /** Intents this gnome handles well */
  preferred_intents?: string[];
  /** Energy levels this gnome thrives in */
  preferred_energy?: string[];
  /** Aggression score range [min, max] where this gnome fits */
  aggression_range?: [number, number];
  /** Absurdity threshold for selection */
  absurdity_threshold?: number;
}

/** Memory rules — what to store/not store for this gnome */
export interface MemoryRules {
  /** Store relationship signals */
  track_affinity?: boolean;
  /** Store running jokes */
  track_jokes?: boolean;
  /** Max memory items per user */
  max_items_per_user?: number;
}

/** Full gnome profile (loaded from YAML) */
export interface GnomeProfile {
  id: string;
  name: string;
  role: string;
  archetype: GnomeArchetype;
  voice_traits?: VoiceTraits;
  language_prefs?: LanguagePrefs;
  routing_hints?: RoutingHints;
  memory_rules?: MemoryRules;
  /** System prompt fragment (per-gnome persona text) */
  persona_fragment?: string;
  /** Safety boundaries (never override) */
  safety_boundaries?: string[];
}

export function isGnomeProfile(v: unknown): v is GnomeProfile {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.role === "string" &&
    typeof o.archetype === "string"
  );
}
