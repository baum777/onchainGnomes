/**
 * World State Store — Persist civilization state
 *
 * Phase-5: In-memory; extend for DB persistence.
 */

import type { WorldState } from "./worldState.js";
import { DEFAULT_WORLD_STATE } from "./worldState.js";

let current: WorldState = { ...DEFAULT_WORLD_STATE };

export function getWorldState(): WorldState {
  return { ...current };
}

export function updateWorldState(updates: Partial<WorldState>): void {
  current = { ...current, ...updates, updatedAt: new Date().toISOString() };
}

/** Reset (for tests). */
export function resetWorldStateStore(): void {
  current = { ...DEFAULT_WORLD_STATE };
}
