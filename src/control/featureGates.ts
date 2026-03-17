/**
 * Feature Gates — Operator control for GNOMES features
 *
 * Phase-5: Enable/disable world events, lore expansion, safe mode.
 */

export interface FeatureGates {
  worldEventsEnabled: boolean;
  loreExpansionEnabled: boolean;
  safeMode: boolean;
}

export function getFeatureGates(): FeatureGates {
  return {
    worldEventsEnabled: process.env.GNOME_WORLD_EVENTS_ENABLED === "true",
    loreExpansionEnabled: process.env.GNOME_LORE_EXPANSION_ENABLED === "true",
    safeMode: process.env.GNOME_SAFE_MODE === "true",
  };
}
