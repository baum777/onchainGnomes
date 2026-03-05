/**
 * Run Artifact Writer — DEBUG only
 *
 * Writes context_bundle.json, intent.json, truth.json, selection.json to local fs
 * when DEBUG_ARTIFACTS=true.
 */

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { loadLaunchEnv } from "../config/env.js";

const ARTIFACT_DIR = "./.run-artifacts";

export async function writeRunArtifact(
  runId: string,
  stage: string,
  data: unknown
): Promise<void> {
  const env = loadLaunchEnv();
  if (!env.DEBUG_ARTIFACTS) return;

  try {
    await mkdir(ARTIFACT_DIR, { recursive: true });
    const fp = join(ARTIFACT_DIR, `${runId}_${stage}.json`);
    await writeFile(fp, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.warn(`[DEBUG] Failed to write artifact ${stage}:`, err);
  }
}
