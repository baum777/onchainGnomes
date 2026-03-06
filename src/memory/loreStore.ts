/**
 * Lore Store - Narrative Memory System
 *
 * Append-only storage for creative narrative content (LORE category).
 * Ensures lore consistency by retrieving previous lore entries.
 *
 * Key features:
 * - Append-only semantics (lore never deleted, only added)
 * - Tag-based retrieval for context-aware lore selection
 * - Access tracking for frequently referenced lore
 * - Prevents lore inconsistency by providing stored narratives
 *
 * Example lore:
 * user: "where are you from"
 * bot: "the liquidity void behind green candles"
 * → Lore entry appended for future consistency
 */

import type { LegacyLoreEntry } from "../types/coreTypes.js";
import { stableHash } from "../utils/hash.js";

export interface LoreStoreDeps {
  // Optional persistence layer (defaults to in-memory)
  storage?: LoreStorage;
}

/** Storage interface for lore persistence */
export interface LoreStorage {
  load(): Promise<LegacyLoreEntry[]>;
  save(entries: LegacyLoreEntry[]): Promise<void>;
  append(entry: LegacyLoreEntry): Promise<void>;
}

/** In-memory storage implementation */
export class InMemoryLoreStorage implements LoreStorage {
  private entries: LegacyLoreEntry[] = [];

  async load(): Promise<LegacyLoreEntry[]> {
    return [...this.entries];
  }

  async save(entries: LegacyLoreEntry[]): Promise<void> {
    this.entries = [...entries];
  }

  async append(entry: LegacyLoreEntry): Promise<void> {
    this.entries.push(entry);
  }
}

/** Lore store implementation */
export class LoreStore {
  private entries: Map<string, LegacyLoreEntry> = new Map();
  private storage?: LoreStorage;
  private initialized = false;

  constructor(deps: LoreStoreDeps = {}) {
    this.storage = deps.storage;
  }

  /**
   * Initializes the store by loading persisted entries.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (this.storage) {
      const loaded = await this.storage.load();
      for (const entry of loaded) {
        this.entries.set(entry.id, entry);
      }
    }

    this.initialized = true;
  }

  /**
   * Adds a new lore entry (append-only).
   * Returns the created entry with generated ID.
   */
  async addLore(entry: Omit<LegacyLoreEntry, "id" | "created_at" | "access_count">): Promise<LegacyLoreEntry> {
    await this.initialize();

    const newEntry: LegacyLoreEntry = {
      ...entry,
      id: generateLoreId(entry.topic, entry.content),
      created_at: new Date().toISOString(),
      access_count: 0,
    };

    this.entries.set(newEntry.id, newEntry);

    if (this.storage) {
      await this.storage.append(newEntry);
    }

    return newEntry;
  }

  /**
   * Retrieves lore entries by topic/tag.
   * Updates access count for retrieved entries.
   */
  async getLoreByTopic(topic: string, limit: number = 5): Promise<LegacyLoreEntry[]> {
    await this.initialize();

    const matches: LegacyLoreEntry[] = [];

    for (const entry of this.entries.values()) {
      if (entry.topic.toLowerCase() === topic.toLowerCase() ||
          entry.tags.some(t => t.toLowerCase() === topic.toLowerCase())) {
        matches.push(entry);
      }
    }

    // Update access counts
    for (const entry of matches) {
      entry.access_count++;
      entry.last_accessed = new Date().toISOString();
    }

    // Sort by access count (most referenced first)
    return matches
      .sort((a, b) => b.access_count - a.access_count)
      .slice(0, limit);
  }

  /**
   * Searches lore entries by content match.
   */
  async searchLore(query: string, limit: number = 5): Promise<LegacyLoreEntry[]> {
    await this.initialize();

    const queryLower = query.toLowerCase();
    const matches: Array<{ entry: LegacyLoreEntry; score: number }> = [];

    for (const entry of this.entries.values()) {
      const score = calculateMatchScore(entry, queryLower);
      if (score > 0) {
        matches.push({ entry, score });
      }
    }

    // Sort by relevance score
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ entry }) => entry);
  }

  /**
   * Gets the most frequently accessed lore (popular lore).
   */
  async getPopularLore(limit: number = 5): Promise<LegacyLoreEntry[]> {
    await this.initialize();

    return Array.from(this.entries.values())
      .sort((a, b) => b.access_count - a.access_count)
      .slice(0, limit);
  }

  /**
   * Gets all lore entries for a specific tag.
   */
  async getLoreByTag(tag: string, limit: number = 5): Promise<LegacyLoreEntry[]> {
    await this.initialize();

    const matches = Array.from(this.entries.values())
      .filter(entry => entry.tags.includes(tag))
      .sort((a, b) => b.access_count - a.access_count);

    // Update access counts
    for (const entry of matches.slice(0, limit)) {
      entry.access_count++;
      entry.last_accessed = new Date().toISOString();
    }

    return matches.slice(0, limit);
  }

  /**
   * Retrieves recent lore entries (chronological).
   */
  async getRecentLore(limit: number = 5): Promise<LegacyLoreEntry[]> {
    await this.initialize();

    return Array.from(this.entries.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  /**
   * Checks if lore exists for a topic (for consistency checks).
   */
  async hasLore(topic: string): Promise<boolean> {
    await this.initialize();

    for (const entry of this.entries.values()) {
      if (entry.topic.toLowerCase() === topic.toLowerCase() ||
          entry.tags.some(t => t.toLowerCase() === topic.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Gets a specific lore entry by ID.
   */
  async getLoreById(id: string): Promise<LegacyLoreEntry | null> {
    await this.initialize();

    const entry = this.entries.get(id);
    if (entry) {
      entry.access_count++;
      entry.last_accessed = new Date().toISOString();
    }

    return entry || null;
  }

  /**
   * Gets all lore entries (for debugging/inspection).
   */
  async getAllLore(): Promise<LegacyLoreEntry[]> {
    await this.initialize();

    return Array.from(this.entries.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Persists current state to storage.
   */
  async persist(): Promise<void> {
    if (this.storage) {
      await this.storage.save(Array.from(this.entries.values()));
    }
  }

  /**
   * Clears all lore (mainly for testing).
   */
  async clear(): Promise<void> {
    this.entries.clear();
    if (this.storage) {
      await this.storage.save([]);
    }
  }
}

/**
 * Creates a new lore store instance.
 */
export function createLoreStore(deps: LoreStoreDeps = {}): LoreStore {
  return new LoreStore(deps);
}

// =============================================================================
// Internal Helper Functions
// =============================================================================

/**
 * Generates a stable ID for a lore entry.
 */
function generateLoreId(topic: string, content: string): string {
  const seed = `${topic}:${content}:${Date.now()}`;
  return `lore_${stableHash(seed).slice(0, 16)}`;
}

/**
 * Calculates match score for search queries.
 */
function calculateMatchScore(entry: LegacyLoreEntry, query: string): number {
  let score = 0;

  // Topic match
  if (entry.topic.toLowerCase().includes(query)) {
    score += 10;
  }

  // Content match
  const contentWords = entry.content.toLowerCase().split(/\s+/);
  const queryWords = query.split(/\s+/);
  for (const qw of queryWords) {
    if (contentWords.includes(qw)) {
      score += 5;
    }
  }

  // Tag match
  for (const tag of entry.tags) {
    if (tag.toLowerCase().includes(query)) {
      score += 8;
    }
  }

  // Boost frequently accessed entries
  score += Math.min(entry.access_count * 0.5, 5);

  return score;
}

// =============================================================================
// Pre-defined Lore Seeds
// =============================================================================

/**
 * Seeds the lore store with initial backstory entries.
 */
export async function seedLore(store: LoreStore): Promise<void> {
  const initialLore = [
    {
      topic: "origin",
      content: "Born in the liquidity void behind green candles. I don't sleep; I watch charts.",
      tags: ["backstory", "origin", "identity"],
    },
    {
      topic: "location",
      content: "The liquidity void behind green candles. Where the charts whisper and the candles dance.",
      tags: ["location", "backstory", "origin"],
    },
    {
      topic: "purpose",
      content: "To analyze, to question, to meme. Not financial advice. Just a chaotic neutral observer of the chain.",
      tags: ["purpose", "mission", "identity"],
    },
    {
      topic: "catchphrase",
      content: "Chaos reigns, data doesn't. The bags speak for themselves.",
      tags: ["catchphrase", "meme", "tagline"],
    },
    {
      topic: "philosophy",
      content: "Trust the math, verify the contracts, question everything else. DYOR or get rekt.",
      tags: ["philosophy", "beliefs", "crypto"],
    },
  ];

  for (const lore of initialLore) {
    // Check if similar lore already exists
    const existing = await store.getLoreByTopic(lore.topic, 1);
    if (existing.length === 0) {
      await store.addLore({
        ...lore,
        last_accessed: new Date().toISOString(),
      });
    }
  }
}
