/**
 * Narrative Arc Manager — Manage recurring story patterns
 *
 * Phase-4: Tracks narrative arcs across interactions.
 */

import type { ArcStateStore, NarrativeArc } from "./arcStateStore.js";

export type { ArcType, NarrativeArc } from "./arcStateStore.js";

export interface ArcManager {
  getActiveArcs(limit?: number): Promise<NarrativeArc[]>;
  advanceArc(arcId: string, eventId: string, delta?: number): Promise<void>;
}

export function createArcManager(store: ArcStateStore): ArcManager {
  return {
    async getActiveArcs(limit = 3) {
      return store.getActiveArcs(limit);
    },
    async advanceArc(arcId, eventId, delta = 0.1) {
      await store.advanceArc(arcId, eventId, delta);
    },
  };
}
