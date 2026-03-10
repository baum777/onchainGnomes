/**
 * Audit Tail — Redis-backed tail der letzten Audit-Einträge.
 * Ermöglicht dem Cron-Job (dailySnippetExtractor) Zugriff auf aktuelle Mentions,
 * auch wenn Worker und Cron keine gemeinsame Disk teilen (z.B. Render).
 *
 * Nutzt LPUSH + LTRIM damit der Tail nicht ewig wächst (max 200).
 */
import type { AuditRecord } from "./types.js";
import { getStateStore } from "../state/storeFactory.js";
import type { RedisStateStore } from "../state/redisStore.js";
import { readAuditLog } from "./auditLog.js";

const TAIL_KEY = "audit:recent";
const TAIL_MAX = 200;

function hasListOps(
  store: Awaited<ReturnType<typeof getStateStore>>,
): store is RedisStateStore {
  return "lpush" in store && "ltrim" in store && "lrange" in store;
}

/** Fügt einen Eintrag zum Redis-Tail hinzu (nur bei publish). LPUSH + LTRIM. */
export async function addToAuditTail(record: AuditRecord): Promise<void> {
  if (record.final_action !== "publish" || !record.reply_text) return;

  try {
    const store = getStateStore();
    if (hasListOps(store)) {
      await store.lpush(TAIL_KEY, JSON.stringify(record));
      await store.ltrim(TAIL_KEY, 0, TAIL_MAX - 1);
      return;
    }
    const raw = await store.get(TAIL_KEY);
    const arr: AuditRecord[] = raw ? (JSON.parse(raw) as AuditRecord[]) : [];
    arr.push(record);
    const trimmed = arr.slice(-TAIL_MAX);
    await store.set(TAIL_KEY, JSON.stringify(trimmed));
  } catch {
    // Redis optional, fail silently
  }
}

/**
 * Liest die letzten Audit-Einträge. Zuerst Redis (List oder JSON), sonst Fallback auf Datei.
 */
export async function getRecentAuditEntries(
  limit: number,
): Promise<AuditRecord[]> {
  try {
    const store = getStateStore();
    if (hasListOps(store)) {
      const items = await store.lrange(TAIL_KEY, 0, limit - 1);
      return items.map((s) => JSON.parse(s) as AuditRecord);
    }
    const raw = await store.get(TAIL_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as AuditRecord[];
      return arr.slice(-limit);
    }
  } catch {
    // Fallback
  }
  const fromFile = await readAuditLog();
  const published = fromFile.filter((r) => r.final_action === "publish");
  return published.slice(-limit);
}
