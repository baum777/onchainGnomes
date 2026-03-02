/**
 * LRU Image Cache
 *
 * In-memory LRU cache with TTL support.
 * Simple but effective for single-node deployments.
 */

import type { ImageCache, CacheKey, CachedImage, CacheStats } from "./imageCache.js";

type CacheEntry = {
  image: CachedImage;
  expiresAt: number; // timestamp in ms
};

export type LRUCacheConfig = {
  maxSize?: number; // max number of entries
  defaultTtlHours?: number; // default TTL
};

const DEFAULT_MAX_SIZE = 100;
const DEFAULT_TTL_HOURS = 6;

export class LRUImageCache implements ImageCache {
  private cache: Map<CacheKey, CacheEntry>;
  private maxSize: number;
  private defaultTtlMs: number;
  private stats: { hits: number; misses: number };

  constructor(config?: LRUCacheConfig) {
    this.maxSize = config?.maxSize ?? DEFAULT_MAX_SIZE;
    this.defaultTtlMs = (config?.defaultTtlHours ?? DEFAULT_TTL_HOURS) * 60 * 60 * 1000;
    this.cache = new Map();
    this.stats = { hits: 0, misses: 0 };
  }

  async get(key: CacheKey): Promise<CachedImage | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    this.stats.hits++;
    return entry.image;
  }

  async set(key: CacheKey, image: CachedImage, ttlHours?: number): Promise<void> {
    const ttlMs = (ttlHours ?? this.defaultTtlMs / 60 / 60 / 1000) * 60 * 60 * 1000;
    const expiresAt = Date.now() + ttlMs;

    // If at capacity, remove oldest (first item in Map)
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    // Remove existing entry to move to end
    this.cache.delete(key);
    this.cache.set(key, { image, expiresAt });
  }

  async has(key: CacheKey): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async delete(key: CacheKey): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  getStats(): CacheStats {
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
    };
  }

  /**
   * Clean up expired entries
   * Call periodically if needed
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Get hit rate as percentage
   */
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    if (total === 0) return 0;
    return Math.round((this.stats.hits / total) * 100);
  }
}

/**
 * Singleton instance for shared use
 */
let globalCache: LRUImageCache | null = null;

export function getGlobalImageCache(config?: LRUCacheConfig): LRUImageCache {
  if (!globalCache) {
    globalCache = new LRUImageCache(config);
  }
  return globalCache;
}

export function resetGlobalImageCache(): void {
  globalCache = null;
}
