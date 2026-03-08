/**
 * Launch environment configuration
 *
 * Validates LAUNCH_MODE, LLM_PROVIDER, allowlist, etc.
 * Exits early with clear error if required vars missing when LAUNCH_MODE != off.
 */

import { z } from "zod";

const LaunchModeSchema = z.enum(["off", "dry_run", "staging", "prod"]);
export type LaunchMode = z.infer<typeof LaunchModeSchema>;

const LogLevelSchema = z.enum(["debug", "info", "warn", "error"]);
export type LogLevel = z.infer<typeof LogLevelSchema>;

const LLMProviderSchema = z.enum(["xai", "openai", "anthropic"]);
export type LLMProvider = z.infer<typeof LLMProviderSchema>;

const allowlistSchema = z
  .string()
  .optional()
  .default("")
  .transform((v) =>
    v
      .split(",")
      .map((s) => s.trim().toLowerCase().replace(/^@/, ""))
      .filter(Boolean)
  );

export const launchEnvSchema = z.object({
  LAUNCH_MODE: LaunchModeSchema.default("off"),
  LOG_LEVEL: LogLevelSchema.default("info"),
  LLM_PROVIDER: LLMProviderSchema.default("xai"),
  LLM_API_KEY: z.string().optional().default(""),
  XAI_API_KEY: z.string().optional().default(""),
  ALLOWLIST_HANDLES: allowlistSchema,
  DEBUG_ARTIFACTS: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
});

export type LaunchEnv = z.infer<typeof launchEnvSchema>;

let cached: LaunchEnv | null = null;

/** Reset cache (for tests). */
export function resetLaunchEnvCache(): void {
  cached = null;
}

/**
 * Load and validate launch env. Cached after first call.
 * Does NOT throw when LAUNCH_MODE=off (LLM_API_KEY optional).
 */
export function loadLaunchEnv(): LaunchEnv {
  if (cached) return cached;

  // Backward compat: when LAUNCH_MODE not set, infer from DRY_RUN
  const inferredMode =
    process.env.LAUNCH_MODE ??
    (process.env.DRY_RUN === "true" ? "dry_run" : "prod");

  const result = launchEnvSchema.safeParse({
    LAUNCH_MODE: inferredMode,
    LOG_LEVEL: (process.env.LOG_LEVEL ?? "info").toLowerCase(),
    LLM_PROVIDER: (process.env.LLM_PROVIDER ?? "xai").toLowerCase(),
    LLM_API_KEY: process.env.LLM_API_KEY ?? process.env.XAI_API_KEY ?? "",
    XAI_API_KEY: process.env.XAI_API_KEY ?? "",
    ALLOWLIST_HANDLES: process.env.ALLOWLIST_HANDLES ?? "",
    DEBUG_ARTIFACTS: process.env.DEBUG_ARTIFACTS,
  });

  if (!result.success) {
    const msg = result.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    throw new Error(`Launch env validation failed: ${msg}`);
  }

  cached = result.data;
  return cached;
}

/**
 * Validate that required secrets exist when LAUNCH_MODE != off.
 * Call early in index.ts. Exits process with code 1 on failure.
 */
export function validateLaunchEnvOrExit(): LaunchEnv {
  const env = loadLaunchEnv();

  if (env.LAUNCH_MODE === "off") {
    return env;
  }

  const apiKey = env.LLM_API_KEY || env.XAI_API_KEY;
  if (!apiKey || apiKey.length < 10) {
    console.error(
      "[FATAL] LAUNCH_MODE is not 'off' but LLM_API_KEY (or XAI_API_KEY) is missing or invalid. Set it or use LAUNCH_MODE=off."
    );
    process.exit(1);
  }

  if (env.LAUNCH_MODE === "staging" && env.ALLOWLIST_HANDLES.length === 0) {
    console.warn(
      "[WARN] LAUNCH_MODE=staging but ALLOWLIST_HANDLES is empty. No tweets will be posted."
    );
  }

  return env;
}
