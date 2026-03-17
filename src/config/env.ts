/**
 * Launch environment configuration
 *
 * Validates LAUNCH_MODE, LLM provider selection and provider-specific secrets.
 */

import { z } from "zod";
import type { LLMProvider } from "../clients/llmClient.js";

const LaunchModeSchema = z.enum(["off", "dry_run", "staging", "prod"]);
export type LaunchMode = z.infer<typeof LaunchModeSchema>;

const LogLevelSchema = z.enum(["debug", "info", "warn", "error"]);
export type LogLevel = z.infer<typeof LogLevelSchema>;

const LLMProviderSchema = z.enum(["xai", "openai", "anthropic"]);

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
  LLM_FALLBACK_PROVIDER: LLMProviderSchema.optional(),
  LLM_API_KEY: z.string().optional().default(""),
  XAI_API_KEY: z.string().optional().default(""),
  OPENAI_API_KEY: z.string().optional().default(""),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  ALLOWLIST_HANDLES: allowlistSchema,
  DEBUG_ARTIFACTS: z
    .string()
    .optional()
    .transform((v) => v === "true" || v === "1"),
  SOLANA_RPC_PRIMARY_URL: z.string().url().optional().default("https://api.mainnet-beta.solana.com"),
  SOLANA_RPC_FALLBACK_URL: z.string().url().optional(),
});

export type LaunchEnv = z.infer<typeof launchEnvSchema>;

let cached: LaunchEnv | null = null;

/** Reset cache (for tests). */
export function resetLaunchEnvCache(): void {
  cached = null;
}

function providerApiKey(env: LaunchEnv, provider: LLMProvider): string {
  if (provider === "xai") return env.XAI_API_KEY || env.LLM_API_KEY;
  if (provider === "openai") return env.OPENAI_API_KEY || env.LLM_API_KEY;
  return env.ANTHROPIC_API_KEY;
}

/**
 * Load and validate launch env. Cached after first call.
 * Does NOT throw when LAUNCH_MODE=off (provider keys optional).
 */
export function loadLaunchEnv(): LaunchEnv {
  if (cached) return cached;

  const inferredMode =
    process.env.LAUNCH_MODE ??
    (process.env.DRY_RUN === "true" ? "dry_run" : "prod");

  const result = launchEnvSchema.safeParse({
    LAUNCH_MODE: inferredMode,
    LOG_LEVEL: (process.env.LOG_LEVEL ?? "info").toLowerCase(),
    LLM_PROVIDER: (process.env.LLM_PROVIDER ?? (process.env.XAI_API_KEY ? "xai" : "openai")).toLowerCase(),
    LLM_FALLBACK_PROVIDER: process.env.LLM_FALLBACK_PROVIDER?.toLowerCase() || undefined,
    LLM_API_KEY: process.env.LLM_API_KEY ?? "",
    XAI_API_KEY: process.env.XAI_API_KEY ?? "",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "",
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
    ALLOWLIST_HANDLES: process.env.ALLOWLIST_HANDLES ?? "",
    DEBUG_ARTIFACTS: process.env.DEBUG_ARTIFACTS,
    SOLANA_RPC_PRIMARY_URL: process.env.SOLANA_RPC_PRIMARY_URL,
    SOLANA_RPC_FALLBACK_URL: process.env.SOLANA_RPC_FALLBACK_URL,
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
 */
export function validateLaunchEnvOrExit(): LaunchEnv {
  const env = loadLaunchEnv();

  if (env.LAUNCH_MODE === "off") {
    return env;
  }

  const primaryKey = providerApiKey(env, env.LLM_PROVIDER);
  if (!primaryKey || primaryKey.length < 10) {
    console.error(
      `[FATAL] LAUNCH_MODE=${env.LAUNCH_MODE} requires API key for LLM_PROVIDER=${env.LLM_PROVIDER}.`
    );
    process.exit(1);
  }

  if (env.LLM_FALLBACK_PROVIDER) {
    if (env.LLM_FALLBACK_PROVIDER === env.LLM_PROVIDER) {
      console.error("[FATAL] LLM_FALLBACK_PROVIDER must differ from LLM_PROVIDER.");
      process.exit(1);
    }
    const fallbackKey = providerApiKey(env, env.LLM_FALLBACK_PROVIDER);
    if (!fallbackKey || fallbackKey.length < 10) {
      console.error(
        `[FATAL] LLM_FALLBACK_PROVIDER=${env.LLM_FALLBACK_PROVIDER} is set but API key is missing/invalid.`
      );
      process.exit(1);
    }
  }

  if (env.LAUNCH_MODE === "staging" && env.ALLOWLIST_HANDLES.length === 0) {
    console.warn(
      "[WARN] LAUNCH_MODE=staging but ALLOWLIST_HANDLES is empty. No tweets will be posted."
    );
  }

  return env;
}
