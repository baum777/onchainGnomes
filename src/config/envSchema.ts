/**
 * Environment variable validation with Zod
 *
 * Fail-fast at boot only for missing critical secrets.
 * Optional vars have defaults; transient API failures are not validated here.
 */
import { z } from "zod";

const pollIntervalSchema = z
  .string()
  .optional()
  .transform((v: string | undefined) => (v ? Number(v) : 30_000))
  .pipe(z.number().min(5_000).max(300_000));

const modelListSchema = z
  .string()
  .optional()
  .transform((v: string | undefined) =>
    v
      ? v
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : []
  );

export const envSchema = z.object({
  // Critical: X/Twitter API (required for polling)
  X_CLIENT_ID: z.string().min(1, "X_CLIENT_ID is required"),
  X_CLIENT_SECRET: z.string().min(1, "X_CLIENT_SECRET is required"),
  X_REFRESH_TOKEN: z.string().min(1, "X_REFRESH_TOKEN is required"),
  X_ACCESS_TOKEN: z.string().optional().default(""),

  // xAI (optional — bot runs in degraded mode without LLM)
  XAI_API_KEY: z.string().optional().default(""),
  XAI_BASE_URL: z.string().url().optional().default("https://api.x.ai/v1"),
  XAI_MODEL_PRIMARY: z.string().optional().default("grok-3"),
  XAI_MODEL_FALLBACKS: modelListSchema,

  // LLM provider routing
  LLM_PROVIDER: z.enum(["xai", "openai", "anthropic"]).optional().default("xai"),
  LLM_FALLBACK_PROVIDER: z.enum(["xai", "openai", "anthropic"]).optional(),
  LLM_TIMEOUT_MS: z.string().optional(),
  LLM_RETRY_MAX: z.string().optional(),
  LLM_MAX_TOKENS: z.string().optional(),
  LLM_TEMPERATURE: z.string().optional(),

  // OpenAI
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().optional().default("gpt-4o-mini"),
  OPENAI_BASE_URL: z.string().url().optional().default("https://api.openai.com/v1"),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  ANTHROPIC_MODEL: z.string().optional().default("claude-3-5-sonnet-latest"),
  ANTHROPIC_BASE_URL: z.string().url().optional().default("https://api.anthropic.com/v1"),

  // Redis configuration
  USE_REDIS: z
    .string()
    .optional()
    .default("false")
    .transform((v: string | undefined) => v === "true"),

  KV_URL: z
    .string()
    .optional()
    .refine(
      (val) => !val || val.startsWith("redis://") || val.startsWith("rediss://"),
      "KV_URL must use redis:// or rediss:// protocol"
    ),

  REDIS_KEY_PREFIX: z.string().optional().default("GNOMES_ONCHAIN:"),

  // Poll config
  POLL_INTERVAL_MS: pollIntervalSchema,

  // FIXED: LOG_LEVEL enum (removed DEBUGGING)
  LOG_LEVEL: z
    .enum(["DEBUG", "INFO", "WARN", "ERROR"])
    .optional()
    .default("INFO"),

  DRY_RUN: z
    .string()
    .optional()
    .default("false")
    .transform((v: string | undefined) => v === "true"),

  TIMELINE_ENGAGEMENT_ENABLED: z.string().optional().default("false"),
  TIMELINE_ENGAGEMENT_INTERVAL_MS: z.string().optional(),
  TIMELINE_ENGAGEMENT_MAX_PER_RUN: z.string().optional(),
  TIMELINE_ENGAGEMENT_MAX_PER_HOUR: z.string().optional(),
  TIMELINE_ENGAGEMENT_MAX_PER_DAY: z.string().optional(),
  TIMELINE_MIN_CONTEXT_SCORE: z.string().optional(),
  TIMELINE_MIN_FINAL_SCORE: z.string().optional(),
  TIMELINE_REQUIRE_THREAD_STRUCTURE: z.string().optional().default("false"),
  TIMELINE_SOURCE_ACCOUNTS: z.string().optional().default(""),
  TIMELINE_KEYWORD_FILTERS: z.string().optional().default(""),
  TIMELINE_AUTHOR_COOLDOWN_MINUTES: z.string().optional(),
  TIMELINE_CONVERSATION_COOLDOWN_MINUTES: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validate env at boot. Throws if critical secrets are missing.
 * Call this early in index.ts before starting the worker loop.
 */
export function validateEnv(): EnvConfig {
  const result = envSchema.safeParse({
    X_CLIENT_ID: process.env.X_CLIENT_ID ?? "",
    X_CLIENT_SECRET: process.env.X_CLIENT_SECRET ?? "",
    X_REFRESH_TOKEN: process.env.X_REFRESH_TOKEN ?? "",
    X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN ?? "",
    XAI_API_KEY: process.env.XAI_API_KEY ?? "",
    XAI_BASE_URL: process.env.XAI_BASE_URL,
    XAI_MODEL_PRIMARY: process.env.XAI_MODEL_PRIMARY ?? process.env.XAI_MODEL,
    XAI_MODEL_FALLBACKS: process.env.XAI_MODEL_FALLBACKS,
    LLM_PROVIDER: process.env.LLM_PROVIDER?.toLowerCase(),
    LLM_FALLBACK_PROVIDER: process.env.LLM_FALLBACK_PROVIDER?.toLowerCase() || undefined,
    LLM_TIMEOUT_MS: process.env.LLM_TIMEOUT_MS,
    LLM_RETRY_MAX: process.env.LLM_RETRY_MAX,
    LLM_MAX_TOKENS: process.env.LLM_MAX_TOKENS,
    LLM_TEMPERATURE: process.env.LLM_TEMPERATURE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? process.env.LLM_API_KEY ?? "",
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
    USE_REDIS: process.env.USE_REDIS,
    KV_URL: process.env.KV_URL,
    REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX,
    POLL_INTERVAL_MS: process.env.POLL_INTERVAL_MS,
    LOG_LEVEL: process.env.LOG_LEVEL,
    DRY_RUN: process.env.DRY_RUN,
    TIMELINE_ENGAGEMENT_ENABLED: process.env.TIMELINE_ENGAGEMENT_ENABLED,
    TIMELINE_ENGAGEMENT_INTERVAL_MS: process.env.TIMELINE_ENGAGEMENT_INTERVAL_MS,
    TIMELINE_ENGAGEMENT_MAX_PER_RUN: process.env.TIMELINE_ENGAGEMENT_MAX_PER_RUN,
    TIMELINE_ENGAGEMENT_MAX_PER_HOUR: process.env.TIMELINE_ENGAGEMENT_MAX_PER_HOUR,
    TIMELINE_ENGAGEMENT_MAX_PER_DAY: process.env.TIMELINE_ENGAGEMENT_MAX_PER_DAY,
    TIMELINE_MIN_CONTEXT_SCORE: process.env.TIMELINE_MIN_CONTEXT_SCORE,
    TIMELINE_MIN_FINAL_SCORE: process.env.TIMELINE_MIN_FINAL_SCORE,
    TIMELINE_REQUIRE_THREAD_STRUCTURE: process.env.TIMELINE_REQUIRE_THREAD_STRUCTURE,
    TIMELINE_SOURCE_ACCOUNTS: process.env.TIMELINE_SOURCE_ACCOUNTS,
    TIMELINE_KEYWORD_FILTERS: process.env.TIMELINE_KEYWORD_FILTERS,
    TIMELINE_AUTHOR_COOLDOWN_MINUTES: process.env.TIMELINE_AUTHOR_COOLDOWN_MINUTES,
    TIMELINE_CONVERSATION_COOLDOWN_MINUTES: process.env.TIMELINE_CONVERSATION_COOLDOWN_MINUTES,
  });

  if (!result.success) {
    const msg = result.error.errors
      .map((e: { path: (string | number)[]; message: string }) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    throw new Error(`Env validation failed: ${msg}`);
  }

  return result.data;
}
