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

export type ReplyLogFields = {
  run_id?: string;
  tweet_id?: string;
  mode?: string;
  truth_level?: string;
  selected_candidate_id?: string;
  action?: "refuse" | "post" | "log_only";
  stage?: string;
  duration_ms?: number;
  [key: string]: unknown;
};

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
  const line = formatLog(level, message, fields);
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
