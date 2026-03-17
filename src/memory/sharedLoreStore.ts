/**
 * Shared Lore Store — GNOMES-compatible lore interface
 *
 * Wraps the existing LoreStore for shared canon fragments.
 * Provides a lightweight API for prompt composition.
 */

import type { LoreStore } from "./loreStore.js";

export interface LoreFragment {
  id: string;
  topic: string;
  content: string;
  tags?: string[];
}

export interface SharedLoreStore {
  /** Get lore fragments by topic/tags for prompt context. */
  getFragments(opts: { topic?: string; tags?: string[]; limit?: number }): Promise<LoreFragment[]>;
}

/** Adapter that wraps LoreStore. */
export function createSharedLoreStore(loreStore: LoreStore): SharedLoreStore {
  return {
    async getFragments(opts: { topic?: string; tags?: string[]; limit?: number }): Promise<LoreFragment[]> {
      const limit = opts.limit ?? 5;
      let entries;
      if (opts.topic) {
        entries = await loreStore.getLoreByTopic(opts.topic, limit);
      } else if (opts.tags?.length) {
        const results: LoreFragment[] = [];
        for (const tag of opts.tags.slice(0, 2)) {
          const byTag = await loreStore.getLoreByTag(tag, limit);
          for (const e of byTag) {
            if (!results.some((r) => r.id === e.id)) results.push({ id: e.id, topic: e.topic, content: e.content, tags: e.tags });
          }
          if (results.length >= limit) break;
        }
        return results.slice(0, limit);
      } else {
        entries = await loreStore.getRecentLore(limit);
      }
      return entries.map((e) => ({ id: e.id, topic: e.topic, content: e.content, tags: e.tags }));
    },
  };
}
