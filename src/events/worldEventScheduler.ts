/**
 * World Event Scheduler — Determine active events
 *
 * Phase-5: Bounded event activation based on context.
 */

export interface ActiveEvent {
  eventId: string;
  type: string;
  startAt: string;
}

/** Select active events (stub: returns empty when disabled). */
export function scheduleActiveEvents(
  _context: { marketEnergy?: string; intentVolume?: Record<string, number> },
  opts?: { maxActive?: number; enabled?: boolean },
): ActiveEvent[] {
  if (!opts?.enabled || (opts?.maxActive ?? 0) < 1) return [];
  return [];
}
