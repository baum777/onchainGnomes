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
  /** Phase-3: Enable trait evolution */
  GNOME_EVOLUTION_ENABLED: boolean;
  /** Phase-3: Enable running jokes */
  GNOME_RUNNING_JOKES_ENABLED: boolean;
  /** Phase-3: Enable swarm/cameo replies */
  GNOME_SWARM_ENABLED: boolean;
  /** Phase-3: Max trait drift per 100 interactions */
  GNOME_TRAIT_DRIFT_LIMIT: number;
}

const DEFAULTS: GnomesConfig = {
  GNOMES_ENABLED: false,
  DEFAULT_SAFE_GNOME: "gorky",
  GNOME_MEMORY_ENABLED: false,
  GNOME_ROUTING_DEBUG: false,
  GNOME_CONTINUITY_ENABLED: true,
  GNOME_EVOLUTION_ENABLED: false,
  GNOME_RUNNING_JOKES_ENABLED: false,
  GNOME_SWARM_ENABLED: false,
  GNOME_TRAIT_DRIFT_LIMIT: 0.25,
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
    GNOME_EVOLUTION_ENABLED: process.env.GNOME_EVOLUTION_ENABLED === "true",
    GNOME_RUNNING_JOKES_ENABLED: process.env.GNOME_RUNNING_JOKES_ENABLED === "true",
    GNOME_SWARM_ENABLED: process.env.GNOME_SWARM_ENABLED === "true",
    GNOME_TRAIT_DRIFT_LIMIT: Number(process.env.GNOME_TRAIT_DRIFT_LIMIT) || DEFAULTS.GNOME_TRAIT_DRIFT_LIMIT,
  };
  return cached;
}

/** Reset cache (for tests). */
export function resetGnomesConfigCache(): void {
  cached = null;
}
