/**
 * GNOMES Feature Config — Feature gates for multi-gnome system
 *
 * All GNOMES features are disabled by default. Enable via env for incremental rollout.
 */

export interface GnomesConfig {
  /** Enable multi-gnome routing and prompt composition */
  GNOMES_ENABLED: boolean;
  /** Safe fallback gnome id when routing uncertain */
  DEFAULT_SAFE_GNOME: string;
  /** Enable user-gnome affinity and interaction writeback */
  GNOME_MEMORY_ENABLED: boolean;
  /** Enable routing debug logs */
  GNOME_ROUTING_DEBUG: boolean;
  /** Enable continuity preservation within threads */
  GNOME_CONTINUITY_ENABLED: boolean;
}

const DEFAULTS: GnomesConfig = {
  GNOMES_ENABLED: false,
  DEFAULT_SAFE_GNOME: "gorky",
  GNOME_MEMORY_ENABLED: false,
  GNOME_ROUTING_DEBUG: false,
  GNOME_CONTINUITY_ENABLED: true,
};

let cached: GnomesConfig | null = null;

export function getGnomesConfig(): GnomesConfig {
  if (cached) return cached;
  cached = {
    GNOMES_ENABLED: process.env.GNOMES_ENABLED === "true",
    DEFAULT_SAFE_GNOME: process.env.DEFAULT_SAFE_GNOME ?? DEFAULTS.DEFAULT_SAFE_GNOME,
    GNOME_MEMORY_ENABLED: process.env.GNOME_MEMORY_ENABLED === "true",
    GNOME_ROUTING_DEBUG: process.env.GNOME_ROUTING_DEBUG === "true",
    GNOME_CONTINUITY_ENABLED: process.env.GNOME_CONTINUITY_ENABLED !== "false",
  };
  return cached;
}

/** Reset cache (for tests). */
export function resetGnomesConfigCache(): void {
  cached = null;
}
