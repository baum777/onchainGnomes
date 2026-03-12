/**
 * Runtime Config — Central typed config access.
 *
 * Aggregates envSchema + launchEnv. Use getConfig() instead of direct process.env
 * for consistency and easier testing.
 *
 * Validation (validateEnv, validateLaunchEnvOrExit) must run before first use.
 */

import { validateEnv, type EnvConfig } from "./envSchema.js";
import { loadLaunchEnv, type LaunchEnv } from "./env.js";

export interface RuntimeConfig extends EnvConfig, LaunchEnv {}

let cached: RuntimeConfig | null = null;

/**
 * Get validated runtime config. Cached after first call.
 * Call validateEnv() and validateLaunchEnvOrExit() before first use (index.ts does this).
 */
export function getConfig(): RuntimeConfig {
  if (cached) return cached;
  const env = validateEnv();
  const launch = loadLaunchEnv();
  cached = { ...env, ...launch };
  return cached;
}

/** Reset cache (for tests). */
export function resetConfigCache(): void {
  cached = null;
}
