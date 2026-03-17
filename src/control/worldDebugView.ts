/**
 * World Debug View — Inspect active world-state
 *
 * Phase-5: Operator/debug surface (never public).
 */

import type { WorldState } from "../world/worldState.js";

export interface DebugSnapshot {
  worldState?: WorldState;
  activeEventIds: string[];
  timestamp: string;
}

export function getWorldDebugSnapshot(
  worldState?: WorldState,
  activeEventIds: string[] = [],
): DebugSnapshot {
  return {
    worldState,
    activeEventIds,
    timestamp: new Date().toISOString(),
  };
}
