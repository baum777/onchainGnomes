/**
 * World Governance — Pacing, limits, anti-spam
 *
 * Phase-5: Prevents world simulation from becoming noisy.
 */

export interface GovernanceLimits {
  maxActiveWorldEvents: number;
  maxActiveRitualOverlays: number;
  maxSwarmPerHour: number;
}

const DEFAULT: GovernanceLimits = {
  maxActiveWorldEvents: Number(process.env.GNOME_MAX_ACTIVE_WORLD_EVENTS) || 2,
  maxActiveRitualOverlays: Number(process.env.GNOME_MAX_ACTIVE_RITUAL_OVERLAYS) || 1,
  maxSwarmPerHour: 2,
};

export function getGovernanceLimits(): GovernanceLimits {
  return { ...DEFAULT };
}
