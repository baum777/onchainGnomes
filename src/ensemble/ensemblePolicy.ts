/**
 * Ensemble Policy — Rules for multi-gnome interaction pacing
 *
 * Phase-4: Enforce ensemble pacing, cameo limits, role switching.
 */

export interface EnsemblePolicyConfig {
  maxCameos: number;
  minEnergyForSwarm: number;
  minRepliesBetweenSwarm: number;
  maxSwarmPerUserPerHour: number;
}

const DEFAULT: EnsemblePolicyConfig = {
  maxCameos: 2,
  minEnergyForSwarm: 0.65,
  minRepliesBetweenSwarm: 3,
  maxSwarmPerUserPerHour: 2,
};

let cached: EnsemblePolicyConfig | null = null;

export function getEnsemblePolicy(): EnsemblePolicyConfig {
  if (cached) return cached;
  cached = {
    maxCameos: Number(process.env.GNOME_MAX_CAMEOS) || DEFAULT.maxCameos,
    minEnergyForSwarm: DEFAULT.minEnergyForSwarm,
    minRepliesBetweenSwarm: DEFAULT.minRepliesBetweenSwarm,
    maxSwarmPerUserPerHour: DEFAULT.maxSwarmPerUserPerHour,
  };
  return cached;
}

/** Check if swarm reply is allowed given recent activity. */
export function mayUseSwarm(
  recentSwarmCount: number,
  recentReplyCount: number,
): boolean {
  const p = getEnsemblePolicy();
  if (recentSwarmCount >= p.maxSwarmPerUserPerHour) return false;
  if (recentReplyCount < p.minRepliesBetweenSwarm) return true; // First few OK
  return recentReplyCount % (p.minRepliesBetweenSwarm + 1) === 0; // Every N replies
}
