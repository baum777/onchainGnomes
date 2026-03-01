import { Embedder } from './embedder.js';
import { safeCosine } from './similarity.js';

interface QueryResult {
  id: string;
  sim: number;
  text: string;
  metadata?: Record<string, unknown>;
}

interface IndexedDocument {
  id: string;
  embedding: number[];
  text: string;
  metadata?: Record<string, unknown>;
  insertedAt: number;
}

interface SemanticIndexConfig {
  ttlDays?: number;
  maxDocs?: number;
}

export class InMemorySemanticIndex {
  private documents: Map<string, IndexedDocument>;
  private maxDocs: number;
  private ttlMs: number;

  constructor(cfg?: SemanticIndexConfig) {
    this.documents = new Map();
    this.maxDocs = cfg?.maxDocs ?? 2000;
    this.ttlMs = (cfg?.ttlDays ?? 7) * 24 * 60 * 60 * 1000;
  }

  async upsert(
    id: string,
    embedding: number[],
    metadata: { text: string } & Record<string, unknown>
  ): Promise<void> {
    this.evictExpired();

    // FIFO eviction if at capacity
    if (this.documents.size >= this.maxDocs && !this.documents.has(id)) {
      this.evictOldest();
    }

    this.documents.set(id, {
      id,
      embedding,
      text: metadata.text,
      metadata,
      insertedAt: Date.now(),
    });
  }

  async query(vec: number[], k: number = 10, threshold: number = 0.5): Promise<QueryResult[]> {
    this.evictExpired();

    if (this.documents.size === 0) {
      return [];
    }

    const results: QueryResult[] = [];

    for (const doc of this.documents.values()) {
      const sim = safeCosine(vec, doc.embedding);
      if (sim >= threshold) {
        results.push({
          id: doc.id,
          sim,
          text: doc.text,
          metadata: doc.metadata,
        });
      }
    }

    // Sort by similarity desc, tie-break by id for determinism
    results.sort((a, b) => {
      if (b.sim !== a.sim) return b.sim - a.sim;
      return a.id.localeCompare(b.id);
    });

    return results.slice(0, k);
  }

  size(): number {
    this.evictExpired();
    return this.documents.size;
  }

  clear(): void {
    this.documents.clear();
  }

  private evictExpired(): void {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, doc] of this.documents) {
      if (now - doc.insertedAt > this.ttlMs) {
        expiredIds.push(id);
      }
    }

    for (const id of expiredIds) {
      this.documents.delete(id);
    }
  }

  private evictOldest(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, doc] of this.documents) {
      if (doc.insertedAt < oldestTime) {
        oldestTime = doc.insertedAt;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.documents.delete(oldestId);
    }
  }
}
