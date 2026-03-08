/**
 * Memory Cache — In-memory store with TTL
 *
 * For launch: in-memory + TTL.
 */

type Entry = { value: string; expiresAt?: number };

const mem = new Map<string, Entry>();

function now(): number {
  return Date.now();
}

export async function cacheGet(key: string): Promise<string | null> {
  const e = mem.get(key);
  if (!e) return null;
  if (e.expiresAt !== undefined && e.expiresAt <= now()) {
    mem.delete(key);
    return null;
  }
  return e.value;
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<void> {
  const expiresAt = ttlSeconds ? now() + ttlSeconds * 1000 : undefined;
  mem.set(key, { value, expiresAt });
}

export async function cacheDel(key: string): Promise<void> {
  mem.delete(key);
}

export async function cacheClear(): Promise<void> {
  mem.clear();
}
