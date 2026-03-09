/**
 * Structured Logger for reply pipeline
 *
 * JSON logs with run_id, tweet_id, mode, truth_level, selected_candidate_id, action.
 */

import { loadLaunchEnv } from "../config/env.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Keys that should never be logged (case-insensitive)
const SENSITIVE_KEYS = [
  "api_key", "apikey", "api-key",
  "secret", "token", "password", "auth",
  "x_api", "x_access", "xai_api", "openai_api",
  "replicate_api", "llm_api", "kv_url", "redis_url",
  "bearer_token", "access_token", "refresh_token"
];

export type ReplyLogFields = {
  run_id?: string;
  tweet_id?: string;
  mode?: string;
  truth_level?: string;
  selected_candidate_id?: string;
  action?: "refuse" | "post" | "log_only" | "skip";
  stage?: string;
  duration_ms?: number;
  [key: string]: unknown;
};

/**
 * Sanitize an object for logging by redacting sensitive values.
 */
export function sanitizeForLog(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLog(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeForLog(value);
    } else if (typeof value === "string") {
      // Redact URLs that might contain credentials
      sanitized[key] = redactSensitiveUrls(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Redact sensitive URLs from strings.
 */
function redactSensitiveUrls(str: string): string {
  // Redact redis:// URLs with credentials
  return str.replace(
    /redis:\/\/[^\s]+/g,
    "[redis-url-redacted]"
  );
}

function shouldLog(level: LogLevel): boolean {
  const env = loadLaunchEnv();
  const configured = LEVEL_ORDER[env.LOG_LEVEL as LogLevel] ?? 1;
  const requested = LEVEL_ORDER[level];
  return requested >= configured;
}

function formatLog(level: LogLevel, message: string, fields?: ReplyLogFields): string {
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...fields,
  };
  return JSON.stringify(payload);
}

export function logReply(
  level: LogLevel,
  message: string,
  fields?: ReplyLogFields
): void {
  if (!shouldLog(level)) return;

  // Sanitize fields before logging
  const safeFields = sanitizeForLog(fields) as ReplyLogFields | undefined;

  const line = formatLog(level, message, safeFields);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function logDebug(message: string, fields?: ReplyLogFields): void {
  logReply("debug", message, fields);
}

export function logInfo(message: string, fields?: ReplyLogFields): void {
  logReply("info", message, fields);
}

export function logWarn(message: string, fields?: ReplyLogFields): void {
  logReply("warn", message, fields);
}

export function logError(message: string, fields?: ReplyLogFields): void {
  logReply("error", message, fields);
}
