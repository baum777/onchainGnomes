/**
 * World State Reducer — Apply signals to world state
 *
 * Phase-5: Bounded updates, mood transitions.
 */

import type { WorldState } from "./worldState.js";
import type { WorldSignals } from "./worldSignals.js";

/** Produce next world state from signals (bounded). */
export function reduceWorldState(
  current: WorldState,
  signals: WorldSignals,
  _opts?: { maxHeatDrift?: number },
): Partial<WorldState> {
  const updates: Partial<WorldState> = {
    globalHeatLevel: Math.max(0, Math.min(1, signals.globalHeatLevel)),
    updatedAt: new Date().toISOString(),
  };
  if (signals.marketEnergy === "EXTREME" && current.globalHeatLevel < 0.8)
    updates.globalHeatLevel = Math.min(1, current.globalHeatLevel + 0.1);
  return updates;
}
