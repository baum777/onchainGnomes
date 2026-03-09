/**
 * Facts Store - Verified Data Storage
 *
 * Stores verified on-chain and market facts with source attribution.
 * Integrates with the token audit engine for automated fact verification.
 *
 * Fact categories:
 * - token: Token metrics, contract data, supply info
 * - chain: Blockchain parameters, network stats
 * - market: Market data, prices, volume
 * - general: General crypto knowledge
 *
 * All facts include verification metadata with expiration.
 */

import type { FactEntry, FactVerification } from "../types/coreTypes.js";
import { stableHash } from "../utils/hash.js";
import { resolveFacts, type FactsResolverInput } from "../truth/factsResolver.js";

export interface FactsStoreDeps {
  storage?: FactsStorage;
  resolver?: any; // Adjusted to be more flexible
}

/** Storage interface for facts persistence */
export interface FactsStorage {
  load(): Promise<FactEntry[]>;
  save(entries: FactEntry[]): Promise<void>;
  append(entry: FactEntry): Promise<void>;
}

/** In-memory storage implementation */
export class InMemoryFactsStorage implements FactsStorage {
  private entries: FactEntry[] = [];

  async load(): Promise<FactEntry[]> {
    return [...this.entries];
  }

  async save(entries: FactEntry[]): Promise<void> {
    this.entries = [...entries];
  }

  async append(entry: FactEntry): Promise<void> {
    this.entries.push(entry);
  }
}

/** Facts store implementation */
export class FactsStore {
  private entries: Map<string, FactEntry> = new Map();
  private storage?: FactsStorage;
  private resolver?: any;
  private initialized = false;

  constructor(deps: FactsStoreDeps = {}) {
    this.storage = deps.storage;
    this.resolver = deps.resolver;
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
   * Adds a verified fact to the store.
   */
  async addFact(
    topic: string,
    content: string,
    category: FactEntry["category"],
    verification: Omit<FactVerification, "timestamp">
  ): Promise<FactEntry> {
    await this.initialize();

    const timestamp = new Date().toISOString();
    const newEntry: FactEntry = {
      id: generateFactId(topic, content),
      topic,
      content,
      category,
      verification: {
        ...verification,
        timestamp,
      },
      created_at: timestamp,
      updated_at: timestamp,
    };

    this.entries.set(newEntry.id, newEntry);

    if (this.storage) {
      await this.storage.append(newEntry);
    }

    return newEntry;
  }

  /**
   * Gets a fact by topic.
   * Returns null if not found or expired.
   */
  async getFact(topic: string): Promise<FactEntry | null> {
    await this.initialize();

    // Find most recent fact for this topic
    let latest: FactEntry | null = null;

    for (const entry of this.entries.values()) {
      if (entry.topic.toLowerCase() === topic.toLowerCase()) {
        if (!latest || new Date(entry.updated_at) > new Date(latest.updated_at)) {
          latest = entry;
        }
      }
    }

    if (!latest) return null;

    // Check if expired
    if (isFactExpired(latest)) {
      return null;
    }

    return latest;
  }

  /**
   * Gets all facts for a topic (including expired).
   */
  async getFactHistory(topic: string): Promise<FactEntry[]> {
    await this.initialize();

    return Array.from(this.entries.values())
      .filter(entry => entry.topic.toLowerCase() === topic.toLowerCase())
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  /**
   * Resolves and stores a fact using the truth engine.
   */
  async resolveAndStore(
    ticker: string,
    contractAddress: string,
    factType: string
  ): Promise<FactEntry | null> {
    await this.initialize();
    
    // Placeholder for router-integrated fact resolution
    return null;
  }

  /**
   * Gets facts by category.
   */
  async getFactsByCategory(
    category: FactEntry["category"],
    limit: number = 10
  ): Promise<FactEntry[]> {
    await this.initialize();

    return Array.from(this.entries.values())
      .filter(entry => entry.category === category)
      .filter(entry => !isFactExpired(entry))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, limit);
  }

  /**
   * Searches facts by content.
   */
  async searchFacts(query: string, limit: number = 10): Promise<FactEntry[]> {
    await this.initialize();

    const queryLower = query.toLowerCase();

    return Array.from(this.entries.values())
      .filter(entry =>
        entry.topic.toLowerCase().includes(queryLower) ||
        entry.content.toLowerCase().includes(queryLower)
      )
      .filter(entry => !isFactExpired(entry))
      .slice(0, limit);
  }

  /**
   * Updates an existing fact (e.g., with fresh data).
   */
  async updateFact(
    id: string,
    updates: Partial<Omit<FactEntry, "id" | "created_at">>
  ): Promise<FactEntry | null> {
    await this.initialize();

    const existing = this.entries.get(id);
    if (!existing) return null;

    const updated: FactEntry = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.entries.set(id, updated);

    if (this.storage) {
      await this.storage.save(Array.from(this.entries.values()));
    }

    return updated;
  }

  /**
   * Invalidates expired facts.
   * Returns count of invalidated facts.
   */
  async invalidateExpired(): Promise<number> {
    await this.initialize();

    let count = 0;

    for (const [id, entry] of this.entries) {
      if (isFactExpired(entry)) {
        // Mark as unverified
        await this.updateFact(id, {
          verification: {
            ...entry.verification,
            verified: false,
          },
        });
        count++;
      }
    }

    return count;
  }

  /**
   * Gets all active (non-expired) facts.
   */
  async getAllActiveFacts(): Promise<FactEntry[]> {
    await this.initialize();

    return Array.from(this.entries.values())
      .filter(entry => !isFactExpired(entry))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }

  /**
   * Clears all facts (mainly for testing).
   */
  async clear(): Promise<void> {
    this.entries.clear();
    if (this.storage) {
      await this.storage.save([]);
    }
  }

  /**
   * Persists current state to storage.
   */
  async persist(): Promise<void> {
    if (this.storage) {
      await this.storage.save(Array.from(this.entries.values()));
    }
  }
}

/**
 * Creates a new facts store instance.
 */
export function createFactsStore(deps: FactsStoreDeps = {}): FactsStore {
  return new FactsStore(deps);
}

// =============================================================================
// Internal Helper Functions
// =============================================================================

/**
 * Generates a stable ID for a fact entry.
 */
function generateFactId(topic: string, content: string): string {
  const seed = `${topic}:${content}`;
  return `fact_${stableHash(seed).slice(0, 16)}`;
}

/**
 * Checks if a fact has expired.
 */
function isFactExpired(entry: FactEntry): boolean {
  if (!entry.verification.expires_at) return false;

  const expiry = new Date(entry.verification.expires_at);
  const now = new Date();

  return now > expiry;
}

/**
 * Determines fact category from fact type.
 */
function determineCategory(factType: string): FactEntry["category"] {
  switch (factType) {
    case "contract_valid":
    case "liquidity":
    case "holders":
    case "dev_wallet":
      return "token";
    default:
      return "general";
  }
}

/**
 * Formats fact content.
 */
function formatFactContent(resolution: any): string {
  return typeof resolution === "string" ? resolution : JSON.stringify(resolution);
}

/**
 * Calculates expiry date based on category.
 */
function calculateExpiry(category: FactEntry["category"]): string {
  const now = new Date();

  switch (category) {
    case "token":
      // Token data expires in 5 minutes (volatile)
      now.setMinutes(now.getMinutes() + 5);
      break;
    case "market":
      // Market data expires in 10 minutes
      now.setMinutes(now.getMinutes() + 10);
      break;
    case "chain":
      // Chain data expires in 1 hour
      now.setHours(now.getHours() + 1);
      break;
    case "general":
    default:
      // General facts expire in 24 hours
      now.setHours(now.getHours() + 24);
      break;
  }

  return now.toISOString();
}
