/**
 * Faction Policy — Faction-aware routing rules
 *
 * Phase-5: Bounded influence.
 */

export interface FactionPolicyConfig {
  factionRoutingWeight: number;
  maxFactionTension: number;
}

const DEFAULT: FactionPolicyConfig = {
  factionRoutingWeight: 0.2,
  maxFactionTension: 0.8,
};

export function getFactionPolicy(): FactionPolicyConfig {
  return { ...DEFAULT };
}
