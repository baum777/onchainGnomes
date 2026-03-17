/**
 * Ritual Effects — Apply ritual overlays to phrasing
 *
 * Phase-5: Cadence, motif fragments.
 */

export interface RitualEffect {
  motifFragment?: string;
}

export function getRitualEffect(ritualId: string): RitualEffect | null {
  if (!ritualId) return null;
  return { motifFragment: ritualId };
}
