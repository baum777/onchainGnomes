/**
 * Image Generator Service
 *
 * High-level service that wraps the Replicate client.
 * Features:
 * - Image caching (LRU with TTL)
 * - Cache key generation
 * - Metrics tracking
 * - Graceful fallback on failure
 */

import { ReplicateImageClient } from "../clients/replicateClient.js";
import type { ImageCache, CachedImage, CacheKey } from "../cache/imageCache.js";
import { buildCacheKey } from "../cache/imageCache.js";

export type GenerateImageArgs = {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  /**
   * Cache context for deterministic key generation.
   * If provided, service will check cache before generation.
   */
  cacheContext?: {
    model: string;
    styleBand: string;
    aspect: string;
    normalizedIntent: string;
    topKeywords: string[];
    humorMode: string;
    energy: number;
    userLevel: number;
  };
};

export type GenerateResult = {
  buffer: Buffer;
  fromCache: boolean;
  latencyMs: number;
};

export class ImageGeneratorService {
  private client: ReplicateImageClient;
  private cache?: ImageCache;
  private defaultTtlHours: number;

  constructor(
    client: ReplicateImageClient,
    options?: {
      cache?: ImageCache;
      defaultTtlHours?: number;
    }
  ) {
    this.client = client;
    this.cache = options?.cache;
    this.defaultTtlHours = options?.defaultTtlHours ?? 6;
  }

  async generate(args: GenerateImageArgs): Promise<Buffer> {
    const result = await this.generateWithMetrics(args);
    return result.buffer;
  }

  async generateWithMetrics(args: GenerateImageArgs): Promise<GenerateResult> {
    const startTime = Date.now();
    let fromCache = false;
    let buffer: Buffer;

    // Check cache if context provided
    if (args.cacheContext && this.cache) {
      const cacheKey = this.buildCacheKeyFromContext(args.cacheContext);
      const cached = await this.cache.get(cacheKey);

      if (cached) {
        return {
          buffer: cached.buffer,
          fromCache: true,
          latencyMs: Date.now() - startTime,
        };
      }
    }

    // Generate via Replicate
    try {
      buffer = await this.client.generateImageBuffer({
        prompt: args.prompt,
        negative_prompt: args.negative_prompt,
        width: args.width ?? 1024,
        height: args.height ?? 1024,
        num_outputs: 1,
        seed: args.seed,
      });
    } catch (error) {
      // Log and re-throw for caller to handle (TEXT fallback)
      console.error("[ImageGenerator] Generation failed:", error);
      throw error;
    }

    // Store in cache if context provided
    if (args.cacheContext && this.cache) {
      const cacheKey = this.buildCacheKeyFromContext(args.cacheContext);
      const latencyMs = Date.now() - startTime;

      await this.cache.set(
        cacheKey,
        {
          buffer,
          mimeType: "image/png", // Replicate typically returns PNG
          metadata: {
            createdAt: new Date(),
            size: buffer.length,
            latencyMs,
            model: args.cacheContext.model,
            styleBand: args.cacheContext.styleBand,
          },
        },
        this.defaultTtlHours
      );
    }

    return {
      buffer,
      fromCache,
      latencyMs: Date.now() - startTime,
    };
  }

  /**
   * Check if a prompt would hit the cache (for pre-flight checks)
   */
  async wouldHitCache(ctx: GenerateImageArgs["cacheContext"]): Promise<boolean> {
    if (!ctx || !this.cache) return false;
    const key = this.buildCacheKeyFromContext(ctx);
    return this.cache.has(key);
  }

  /**
   * Get cache statistics (if cache is configured)
   */
  getCacheStats() {
    if (!this.cache) return null;
    return this.cache.getStats();
  }

  private buildCacheKeyFromContext(
    ctx: NonNullable<GenerateImageArgs["cacheContext"]>
  ): CacheKey {
    return buildCacheKey({
      model: ctx.model,
      styleBand: ctx.styleBand,
      aspect: ctx.aspect,
      normalizedIntent: ctx.normalizedIntent,
      topKeywords: ctx.topKeywords,
      humorMode: ctx.humorMode,
      energy: ctx.energy,
      userLevel: ctx.userLevel,
    });
  }
}

/**
 * Factory function with optional caching
 */
export function createImageGeneratorService(
  client: ReplicateImageClient,
  options?: {
    enableCache?: boolean;
    maxCacheSize?: number;
    defaultTtlHours?: number;
  }
): ImageGeneratorService {
  let cache: ImageCache | undefined;

  if (options?.enableCache) {
    // Dynamic import to avoid circular deps
    const { getGlobalImageCache } = require("../cache/lruImageCache.js");
    cache = getGlobalImageCache({
      maxSize: options.maxCacheSize,
      defaultTtlHours: options.defaultTtlHours,
    });
  }

  return new ImageGeneratorService(client, {
    cache,
    defaultTtlHours: options?.defaultTtlHours,
  });
}
