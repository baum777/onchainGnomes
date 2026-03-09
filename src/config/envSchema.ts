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
  X_API_KEY: z.string().min(1, "X_API_KEY is required"),
  X_API_SECRET: z.string().min(1, "X_API_SECRET is required"),
  X_ACCESS_TOKEN: z.string().min(1, "X_ACCESS_TOKEN is required"),
  X_ACCESS_SECRET: z.string().min(1, "X_ACCESS_SECRET is required"),

  // xAI (optional — bot runs in degraded mode without LLM)
  XAI_API_KEY: z.string().optional().default(""),
  XAI_BASE_URL: z.string().url().optional().default("https://api.x.ai/v1"),
  XAI_MODEL_PRIMARY: z.string().optional().default("grok-3"),
  XAI_MODEL_FALLBACKS: modelListSchema,

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
      (val) => !val || val.startsWith("redis://"),
      "KV_URL must use redis:// protocol"
    ),

  REDIS_KEY_PREFIX: z.string().optional().default("Gorky_on_sol:"),

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
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validate env at boot. Throws if critical secrets are missing.
 * Call this early in index.ts before starting the worker loop.
 */
export function validateEnv(): EnvConfig {
  const result = envSchema.safeParse({
    X_API_KEY: process.env.X_API_KEY ?? "",
    X_API_SECRET: process.env.X_API_SECRET ?? "",
    X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN ?? "",
    X_ACCESS_SECRET: process.env.X_ACCESS_SECRET ?? "",
    XAI_API_KEY: process.env.XAI_API_KEY ?? "",
    XAI_BASE_URL: process.env.XAI_BASE_URL,
    XAI_MODEL_PRIMARY: process.env.XAI_MODEL_PRIMARY ?? process.env.XAI_MODEL,
    XAI_MODEL_FALLBACKS: process.env.XAI_MODEL_FALLBACKS,
    USE_REDIS: process.env.USE_REDIS,
    KV_URL: process.env.KV_URL,
    REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX,
    POLL_INTERVAL_MS: process.env.POLL_INTERVAL_MS,
    LOG_LEVEL: process.env.LOG_LEVEL,
    DRY_RUN: process.env.DRY_RUN,
  });

  if (!result.success) {
    const msg = result.error.errors
      .map((e: { path: (string | number)[]; message: string }) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    throw new Error(`Env validation failed: ${msg}`);
  }

  return result.data;
}
