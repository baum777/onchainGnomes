/**
 * Ritual Selector — Choose ritual overlay for reply
 *
 * Phase-5: Bounded ritual selection.
 */

import type { Ritual } from "./ritualRegistry.js";

/** Select at most one ritual overlay (stub). */
export function selectRitualOverlay(
  _context: { activeEventIds?: string[] },
  opts?: { maxOverlays?: number; enabled?: boolean },
): Ritual | null {
  if (!opts?.enabled || (opts?.maxOverlays ?? 0) < 1) return null;
  return null;
}
