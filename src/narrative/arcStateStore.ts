/**
 * Narrative Arc State Store — Persist arc progress
 *
 * Phase-4: In-memory arc state.
 */

export type ArcType =
  | "market_funeral"
  | "fake_builder_exposed"
  | "liquidity_thirst_cycle"
  | "degen_celebration"
  | "copium_intervention";

export interface NarrativeArc {
  arc_id: string;
  arc_type: ArcType;
  origin_event_id?: string;
  progress: number; // 0..1
  last_update: string;
}

export interface ArcStateStore {
  getActiveArcs(limit?: number): Promise<NarrativeArc[]>;
  advanceArc(arcId: string, eventId: string, delta?: number): Promise<void>;
}

class InMemoryArcStore implements ArcStateStore {
  private arcs = new Map<string, NarrativeArc>();

  async getActiveArcs(limit = 3): Promise<NarrativeArc[]> {
    const list = Array.from(this.arcs.values())
      .filter((a) => a.progress > 0 && a.progress < 1)
      .sort((a, b) => new Date(b.last_update).getTime() - new Date(a.last_update).getTime());
    return list.slice(0, limit);
  }

  async advanceArc(arcId: string, eventId: string, delta = 0.1): Promise<void> {
    const existing = this.arcs.get(arcId);
    const progress = Math.min(1, (existing?.progress ?? 0) + delta);
    this.arcs.set(arcId, {
      arc_id: arcId,
      arc_type: (existing?.arc_type ?? "market_funeral") as ArcType,
      origin_event_id: existing?.origin_event_id ?? eventId,
      progress,
      last_update: new Date().toISOString(),
    });
  }
}

let defaultStore: ArcStateStore | null = null;

export function getArcStateStore(): ArcStateStore {
  if (!defaultStore) defaultStore = new InMemoryArcStore();
  return defaultStore;
}
