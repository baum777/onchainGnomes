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
import type { FactsResolverDeps, FactResolutionResult } from "../truth/factsResolver.js";
import { resolveFact, createFactCache } from "../truth/factsResolver.js";

export interface FactsStoreDeps {
  storage?: FactsStorage;
  resolver?: FactsResolverDeps;
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
  private resolver?: FactsResolverDeps;
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
   * Resolves and stores a fact using the audit engine.
   */
  async resolveAndStore(
    ticker: string,
    contractAddress: string,
    factType: "contract_valid" | "liquidity" | "holders" | "dev_wallet" | "general"
  ): Promise<FactEntry | null> {
    await this.initialize();

    if (!this.resolver) {
      throw new Error("Fact resolver not configured");
    }

    const resolution = await resolveFact(this.resolver, {
      ticker,
      contract_address: contractAddress,
      fact_type: factType,
    });

    if (!resolution.resolved) {
      return null;
    }

    // Determine category based on fact type
    const category = determineCategory(factType);

    // Build content from resolution
    const content = formatFactContent(resolution);

    return this.addFact(
      `${ticker}_${factType}`,
      content,
      category,
      {
        verified: true,
        source: resolution.verification.source,
        expires_at: calculateExpiry(category),
      }
    );
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
 * Formats fact content from resolution result.
 */
function formatFactContent(resolution: FactResolutionResult): string {
  if (resolution.fact_type === "general") {
    const audit = resolution.audit_result;
    if (audit) {
      return JSON.stringify({
        liquidity: audit.metrics.liquidity_usd,
        top10_holders: audit.metrics.top10_holder_percent,
        dev_holdings: audit.metrics.dev_wallet_percent,
        risk_score: audit.risk_score.final_risk,
        verdict: audit.verdict,
      });
    }
  }

  return String(resolution.value);
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
