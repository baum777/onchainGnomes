/**
 * User Affinity Store — User-Gnome relationship signals
 *
 * Lightweight signals for routing: familiarity, preferred gnome, etc.
 * Phase-1: In-memory; Phase-2/3 wire to DB (user_gnome_affinity).
 */

/** Phase-3: Relationship arc signals (0..1) */
export interface RelationshipArcs {
  familiarity: number;
  rivalry?: number;
  playful_banter?: number;
  respect?: number;
  hostility?: number;
  inside_jokes?: number;
}

export interface UserGnomeAffinity {
  user_id: string;
  gnome_id: string;
  familiarity: number;
  last_interaction_at: string;
  interaction_count: number;
  /** Phase-3: Extended relationship arcs */
  arcs?: RelationshipArcs;
}

export interface UserAffinityStore {
  /** Get affinity for user-gnome pair. */
  getAffinity(userId: string, gnomeId: string): Promise<UserGnomeAffinity | null>;
  /** Update after successful interaction (conservative increment). */
  recordInteraction(
    userId: string,
    gnomeId: string,
    opts?: { incrementFamiliarity?: boolean },
  ): Promise<void>;
}

class InMemoryUserAffinityStore implements UserAffinityStore {
  private map = new Map<string, UserGnomeAffinity>();

  private key(userId: string, gnomeId: string): string {
    return `${userId}:${gnomeId}`;
  }

  async getAffinity(userId: string, gnomeId: string): Promise<UserGnomeAffinity | null> {
    return this.map.get(this.key(userId, gnomeId)) ?? null;
  }

  async recordInteraction(
    userId: string,
    gnomeId: string,
    opts?: { incrementFamiliarity?: boolean },
  ): Promise<void> {
    const k = this.key(userId, gnomeId);
    const now = new Date().toISOString();
    const existing = this.map.get(k);
    const inc = opts?.incrementFamiliarity !== false;
    const newFamiliarity = Math.min(
      1,
      (existing?.familiarity ?? 0) + (inc ? 0.05 : 0),
    );
    this.map.set(k, {
      user_id: userId,
      gnome_id: gnomeId,
      familiarity: newFamiliarity,
      last_interaction_at: now,
      interaction_count: (existing?.interaction_count ?? 0) + 1,
    });
  }
}

let defaultStore: UserAffinityStore | null = null;

export function getUserAffinityStore(): UserAffinityStore {
  if (!defaultStore) defaultStore = new InMemoryUserAffinityStore();
  return defaultStore;
}

/** Reset (for tests). */
export function resetUserAffinityStore(): void {
  defaultStore = null;
}
