/**
 * Launch Gate — Fail-closed posting control
 *
 * - off: never post, skip LLM when possible
 * - dry_run: generate but never publish (log only)
 * - staging: publish only to allowlisted handles
 * - prod: full publishing
 */

import { loadLaunchEnv } from "../config/env.js";

export type PostDecision =
  | { action: "post" }
  | { action: "refuse"; reason: string }
  | { action: "log_only"; reason: string };

/**
 * Determine whether we should actually post to X.
 * Use author handle (without @) for allowlist check.
 */
export function shouldPost(authorHandle: string | undefined): PostDecision {
  const env = loadLaunchEnv();

  if (env.LAUNCH_MODE === "off") {
    return { action: "refuse", reason: "LAUNCH_MODE=off" };
  }

  if (env.LAUNCH_MODE === "dry_run") {
    return { action: "log_only", reason: "LAUNCH_MODE=dry_run" };
  }

  if (env.LAUNCH_MODE === "staging") {
    const handle = normalizeHandle(authorHandle);
    const inList = env.ALLOWLIST_HANDLES.some((h) => h === handle);
    if (!inList) {
      return { action: "refuse", reason: `staging: ${handle ?? "unknown"} not in ALLOWLIST_HANDLES` };
    }
  }

  return { action: "post" };
}

/**
 * Whether to skip LLM entirely (LAUNCH_MODE=off).
 */
export function shouldSkipLLM(): boolean {
  const env = loadLaunchEnv();
  return env.LAUNCH_MODE === "off";
}

/**
 * Whether we are in dry-run mode (generate, never publish).
 */
export function isDryRun(): boolean {
  const env = loadLaunchEnv();
  return env.LAUNCH_MODE === "dry_run";
}

/**
 * Get effective dry-run flag for xClient compatibility.
 * true = do not actually post (off or dry_run)
 */
export function isPostingDisabled(): boolean {
  const env = loadLaunchEnv();
  return env.LAUNCH_MODE === "off" || env.LAUNCH_MODE === "dry_run";
}

function normalizeHandle(h: string | undefined): string {
  if (!h) return "";
  return h.toLowerCase().replace(/^@/, "").trim();
}
