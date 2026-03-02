/**
 * Image Cache Interface
 *
 * Abstract interface for image caching.
 * Allows pluggable implementations (in-memory, Redis, S3, etc.)
 */

export type CacheKey = string;

export type CachedImage = {
  buffer: Buffer;
  mimeType: string;
  metadata: {
    createdAt: Date;
    size: number;
    latencyMs?: number;
    model: string;
    styleBand: string;
  };
};

export type CacheStats = {
  hits: number;
  misses: number;
  size: number;
};

export interface ImageCache {
  /**
   * Get image from cache
   * Returns null if not found or expired
   */
  get(key: CacheKey): Promise<CachedImage | null>;

  /**
   * Store image in cache
   */
  set(key: CacheKey, image: CachedImage, ttlHours?: number): Promise<void>;

  /**
   * Check if key exists in cache
   */
  has(key: CacheKey): Promise<boolean>;

  /**
   * Delete from cache
   */
  delete(key: CacheKey): Promise<void>;

  /**
   * Clear all cached images
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): CacheStats;
}

/**
 * Build deterministic cache key from generation parameters
 */
export function buildCacheKey(params: {
  model: string;
  styleBand: string;
  aspect: string;
  normalizedIntent: string;
  topKeywords: string[];
  humorMode: string;
  energy: number;
  userLevel: number;
}): CacheKey {
  // Normalize for consistent hashing
  const normalized = [
    params.model,
    params.styleBand,
    params.aspect,
    params.normalizedIntent.slice(0, 50), // first 50 chars of intent
    params.topKeywords.slice(0, 3).join("+"), // top 3 keywords
    params.humorMode,
    `E${params.energy}`,
    `L${params.userLevel}`,
  ].join("::");

  // Simple hash for the key
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit
  }

  return `img:${Math.abs(hash).toString(36)}:${params.model.replace(/[/:]/g, "_")}`;
}
