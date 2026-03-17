/**
 * Character Memory — Gnome-specific memory snippets
 *
 * Retrieves relevance-ranked, bounded memory items for the selected gnome.
 * Phase-1: In-memory minimal implementation; Phase-3 adds ranking by
 * relevance, recency, persona affinity.
 */

export interface MemoryItem {
  id: string;
  gnome_id: string;
  user_id?: string;
  content: string;
  topic?: string;
  created_at: string;
  relevance_score?: number;
}

export interface CharacterMemoryStore {
  /** Get recent memory items for gnome (and optionally user). Bounded by limit. */
  getItems(opts: {
    gnomeId: string;
    userId?: string;
    topic?: string;
    limit?: number;
  }): Promise<MemoryItem[]>;
  /** Add memory item (bounded, non-sensitive only). */
  addItem(item: Omit<MemoryItem, "id" | "created_at">): Promise<MemoryItem>;
}

/** In-memory implementation for Phase-1. */
class InMemoryCharacterMemory implements CharacterMemoryStore {
  private items: MemoryItem[] = [];
  private idCounter = 0;

  async getItems(opts: {
    gnomeId: string;
    userId?: string;
    topic?: string;
    limit?: number;
  }): Promise<MemoryItem[]> {
    let list = this.items.filter((m) => m.gnome_id === opts.gnomeId);
    if (opts.userId) list = list.filter((m) => m.user_id === opts.userId);
    if (opts.topic) list = list.filter((m) => m.topic === opts.topic);
    list = list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const limit = opts.limit ?? 5;
    return list.slice(0, limit);
  }

  async addItem(item: Omit<MemoryItem, "id" | "created_at">): Promise<MemoryItem> {
    const full: MemoryItem = {
      ...item,
      id: `mem_${++this.idCounter}`,
      created_at: new Date().toISOString(),
    };
    this.items.push(full);
    return full;
  }
}

let defaultStore: CharacterMemoryStore | null = null;

/** Get default in-memory store (for Phase-1). */
export function getCharacterMemoryStore(): CharacterMemoryStore {
  if (!defaultStore) defaultStore = new InMemoryCharacterMemory();
  return defaultStore;
}

/** Reset store (for tests). */
export function resetCharacterMemoryStore(): void {
  defaultStore = null;
}
