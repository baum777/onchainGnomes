/**
 * Evolution Writeback — Persist trait adjustments, joke additions
 *
 * Phase-3: Appends to JSONL for audit/review.
 */

import { appendFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "../../config/dataDir.js";

const EVOLUTION_FILE = "trait_evolution_log.jsonl";

function ts(): string {
  return new Date().toISOString();
}

async function appendLine(record: object): Promise<void> {
  try {
    await access(DATA_DIR).catch(async () => {
      await mkdir(DATA_DIR, { recursive: true });
    });
    const path = join(DATA_DIR, EVOLUTION_FILE);
    await appendFile(path, JSON.stringify(record) + "\n", "utf-8");
  } catch {
    // Fire-and-forget
  }
}

export function writeTraitEvolution(params: {
  gnome_id: string;
  trait_key: string;
  old_value: number;
  new_value: number;
}): void {
  appendLine({
    type: "trait_evolution",
    ...params,
    created_at: ts(),
  }).catch(() => {});
}

export function writeJokeAddition(params: { category: string; content: string; gnome_id?: string }): void {
  appendLine({
    type: "joke_addition",
    ...params,
    created_at: ts(),
  }).catch(() => {});
}
