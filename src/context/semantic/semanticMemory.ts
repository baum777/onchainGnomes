import { safeCosine } from './similarity.js';

interface MemoryEntry {
  id: string;
  userId: string;
  text: string;
  embedding: number[];
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface MemoryConfig {
  ttlDays?: number;
  maxPerUser?: number;
}

export class InMemorySemanticMemoryStore {
  private entries: Map<string, MemoryEntry[]>; // keyed by userId
  private maxPerUser: number;
  private ttlMs: number;

  constructor(cfg?: MemoryConfig) {
    this.entries = new Map();
    this.maxPerUser = cfg?.maxPerUser ?? 50;
    this.ttlMs = (cfg?.ttlDays ?? 14) * 24 * 60 * 60 * 1000;
  }

  async add(
    userId: string,
    id: string,
    text: string,
    embedding: number[],
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const userEntries = this.entries.get(userId) ?? [];

    // Remove expired
    const now = Date.now();
    const filtered = userEntries.filter(e => now - e.timestamp <= this.ttlMs);

    // Add new entry
    filtered.push({
      id,
      userId,
      text,
      embedding,
      timestamp: now,
      metadata,
    });

    // Evict oldest if over limit
    while (filtered.length > this.maxPerUser) {
      filtered.shift();
    }

    this.entries.set(userId, filtered);
  }

  recent(userId: string, n: number = 5): MemoryEntry[] {
    const userEntries = this.entries.get(userId) ?? [];
    const now = Date.now();
    const valid = userEntries.filter(e => now - e.timestamp <= this.ttlMs);
    return valid.slice(-n).reverse();
  }

  async similar(userId: string, seedVec: number[], k: number = 5): Promise<MemoryEntry[]> {
    const userEntries = this.entries.get(userId) ?? [];
    const now = Date.now();
    const valid = userEntries.filter(e => now - e.timestamp <= this.ttlMs);

    if (valid.length === 0) return [];

    const scored = valid.map(e => ({
      entry: e,
      sim: safeCosine(seedVec, e.embedding),
    }));

    scored.sort((a, b) => b.sim - a.sim);
    return scored.slice(0, k).map(s => s.entry);
  }

  size(userId?: string): number {
    if (userId) {
      return this.entries.get(userId)?.length ?? 0;
    }
    let total = 0;
    for (const entries of this.entries.values()) {
      total += entries.length;
    }
    return total;
  }

  clear(userId?: string): void {
    if (userId) {
      this.entries.delete(userId);
    } else {
      this.entries.clear();
    }
  }
}
