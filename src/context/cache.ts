export interface CacheEntry<T> {
  value: T;
  expires_at: number;
}

export interface SimpleCache {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T, ttlMs: number): void;
}

export function createMemoryCache(): SimpleCache {
  const store = new Map<string, CacheEntry<unknown>>();
  return {
    get<T>(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expires_at) {
        store.delete(key);
        return null;
      }
      return entry.value as T;
    },
    set<T>(key: string, value: T, ttlMs: number) {
      store.set(key, { value, expires_at: Date.now() + ttlMs });
    },
  };
}
