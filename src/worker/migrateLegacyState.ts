/**
 * One-time migration from legacy processed_mentions.json to StateStore.
 *
 * Extracted for testability. Used by pollMentions at worker startup.
 */

import fs from "node:fs";
import type { StateStore, CursorState } from "../state/stateStore.js";
import { logInfo, logWarn } from "../ops/logger.js";

export interface LegacyProcessedState {
  last_since_id?: string | null;
  processed?: string[];
}

export interface MigrationResult {
  migratedCount: number;
  cursorSet: boolean;
  fileRenamed: boolean;
}

/**
 * Migrate legacy processed_mentions.json to StateStore.
 * Idempotent when file does not exist (no-op).
 * After successful migration, renames file to .migrated.
 */
export async function migrateLegacyState(
  legacyFilePath: string,
  store: StateStore
): Promise<MigrationResult> {
  const result: MigrationResult = { migratedCount: 0, cursorSet: false, fileRenamed: false };

  try {
    if (!fs.existsSync(legacyFilePath)) return result;

    const raw = fs.readFileSync(legacyFilePath, "utf-8");
    const parsed = JSON.parse(raw) as LegacyProcessedState;
    const processed = parsed.processed ?? [];
    const lastSinceId = parsed.last_since_id ?? null;

    if (processed.length > 0) {
      logInfo("[MIGRATION] Migrating processed mentions to StateStore", { count: processed.length });
      for (const mentionId of processed) {
        await store.setEventState(mentionId, {
          state: "processed_ok",
          eventId: mentionId,
          attempts: 0,
        });
      }
      result.migratedCount = processed.length;
    }

    if (lastSinceId) {
      const cursor: CursorState = {
        since_id: lastSinceId,
        last_fetch_at: new Date().toISOString(),
        fetched_count: 0,
        version: 1,
      };
      await store.setCursor(cursor);
      logInfo("[MIGRATION] Migrated cursor to StateStore", { since_id: lastSinceId });
      result.cursorSet = true;
    }

    const backupPath = legacyFilePath + ".migrated";
    fs.renameSync(legacyFilePath, backupPath);
    logInfo("[MIGRATION] Renamed legacy file to", { backupPath });
    result.fileRenamed = true;
  } catch (error) {
    logWarn("[MIGRATION] Failed to migrate legacy state, continuing fresh", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return result;
}
