/**
 * Repetition Guard - Anti-Repetition System
 *
 * Prevents phrase looping by tracking recently used replies.
 * Uses LRU cache for efficient storage and similarity detection.
 *
 * Features:
 * - Exact match detection
 * - Similarity-based detection (using simple n-gram overlap)
 * - Configurable cache size and TTL
 * - Penalty factor for scoring
 */

import { stableHash } from "../utils/hash.js";

/** Repetition guard configuration */
export interface RepetitionGuardConfig {
  maxCacheSize: number;
  ttlMs: number;
  similarityThreshold: number;
  ngramSize: number;
}

/** Cache entry for a reply */
interface CacheEntry {
  id: string;
  text: string;
  textHash: string;
  ngrams: Set<string>;
  timestamp: number;
  useCount: number;
}

/** Repetition guard implementation */
export class RepetitionGuard {
  private cache: Map<string, CacheEntry> = new Map();
  private config: RepetitionGuardConfig;

  constructor(config?: Partial<RepetitionGuardConfig>) {
    this.config = {
      maxCacheSize: 100,
      ttlMs: 24 * 60 * 60 * 1000, // 24 hours
      similarityThreshold: 0.6,
      ngramSize: 3,
      ...config,
    };
  }

  /**
   * Adds a reply to the cache.
   */
  add(replyText: string): void {
    this.cleanup();

    const textHash = stableHash(replyText.toLowerCase());
    const id = `reply_${textHash.slice(0, 16)}`;

    // Check if already exists
    const existing = this.cache.get(id);
    if (existing) {
      existing.useCount++;
      existing.timestamp = Date.now();
      return;
    }

    // Add new entry
    const entry: CacheEntry = {
      id,
      text: replyText,
      textHash,
      ngrams: extractNgrams(replyText, this.config.ngramSize),
      timestamp: Date.now(),
      useCount: 1,
    };

    this.cache.set(id, entry);

    // Evict oldest if over capacity
    if (this.cache.size > this.config.maxCacheSize) {
      this.evictOldest();
    }
  }

  /**
   * Checks if a reply is repetitive.
   * Returns similarity info and penalty factor.
   */
  check(replyText: string): {
    is_repetitive: boolean;
    similarity_score: number;
    recent_matches: string[];
    penalty_factor: number;
  } {
    this.cleanup();

    const replyLower = replyText.toLowerCase();
    const replyHash = stableHash(replyLower);
    const replyNgrams = extractNgrams(replyText, this.config.ngramSize);

    let maxSimilarity = 0;
    const matches: Array<{ id: string; text: string; similarity: number }> = [];

    for (const entry of this.cache.values()) {
      // Check exact match
      if (entry.textHash === replyHash) {
        return {
          is_repetitive: true,
          similarity_score: 1.0,
          recent_matches: [entry.text],
          penalty_factor: 0.1, // Heavy penalty for exact repeat
        };
      }

      // Check n-gram similarity
      const similarity = calculateNgramSimilarity(replyNgrams, entry.ngrams);
      if (similarity >= this.config.similarityThreshold) {
        matches.push({
          id: entry.id,
          text: entry.text,
          similarity,
        });
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
    }

    // Sort matches by similarity
    matches.sort((a, b) => b.similarity - a.similarity);

    // Calculate penalty based on similarity
    const penalty_factor = calculatePenalty(maxSimilarity);

    return {
      is_repetitive: maxSimilarity >= this.config.similarityThreshold,
      similarity_score: maxSimilarity,
      recent_matches: matches.slice(0, 3).map(m => m.text),
      penalty_factor,
    };
  }

  /**
   * Gets all cached entries.
   */
  getAll(): Array<{ text: string; timestamp: number; useCount: number }> {
    this.cleanup();

    return Array.from(this.cache.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(e => ({ text: e.text, timestamp: e.timestamp, useCount: e.useCount }));
  }

  /**
   * Clears the cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Gets cache statistics.
   */
  getStats(): {
    size: number;
    maxSize: number;
    oldestEntry?: number;
    newestEntry?: number;
  } {
    this.cleanup();

    const entries = Array.from(this.cache.values());
    const timestamps = entries.map(e => e.timestamp);

    return {
      size: this.cache.size,
      maxSize: this.config.maxCacheSize,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : undefined,
    };
  }

  /**
   * Removes expired entries.
   */
  private cleanup(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [id, entry] of this.cache) {
      if (now - entry.timestamp > this.config.ttlMs) {
        expired.push(id);
      }
    }

    for (const id of expired) {
      this.cache.delete(id);
    }
  }

  /**
   * Evicts the oldest entry.
   */
  private evictOldest(): void {
    let oldest: CacheEntry | null = null;
    let oldestId = "";

    for (const [id, entry] of this.cache) {
      if (!oldest || entry.timestamp < oldest.timestamp) {
        oldest = entry;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.cache.delete(oldestId);
    }
  }
}

/**
 * Creates a new repetition guard instance.
 */
export function createRepetitionGuard(config?: Partial<RepetitionGuardConfig>): RepetitionGuard {
  return new RepetitionGuard(config);
}

// =============================================================================
// Internal Helper Functions
// =============================================================================

/**
 * Extracts n-grams from text.
 */
function extractNgrams(text: string, n: number): Set<string> {
  const ngrams = new Set<string>();

  // Normalize text
  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 0);

  for (let i = 0; i <= normalized.length - n; i++) {
    const ngram = normalized.slice(i, i + n).join(" ");
    ngrams.add(ngram);
  }

  return ngrams;
}

/**
 * Calculates Jaccard similarity between two n-gram sets.
 */
function calculateNgramSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;

  const intersection = new Set<string>();
  for (const ngram of a) {
    if (b.has(ngram)) {
      intersection.add(ngram);
    }
  }

  const union = new Set<string>([...a, ...b]);

  return intersection.size / union.size;
}

/**
 * Calculates penalty factor based on similarity.
 */
function calculatePenalty(similarity: number): number {
  // Linear penalty: 1.0 (no penalty) at 0.0 similarity
  // 0.1 (heavy penalty) at 1.0 similarity
  if (similarity < 0.3) return 1.0;
  if (similarity < 0.5) return 0.8;
  if (similarity < 0.6) return 0.6;
  if (similarity < 0.8) return 0.4;
  return 0.1;
}

/**
 * Quick check for simple exact match (no cache needed).
 */
export function isExactMatch(text1: string, text2: string): boolean {
  return text1.toLowerCase().trim() === text2.toLowerCase().trim();
}

/**
 * Calculates simple similarity for quick checks.
 */
export function quickSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set<string>();
  for (const word of words1) {
    if (words2.has(word)) {
      intersection.add(word);
    }
  }

  const union = new Set<string>([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}
