import { stableHash } from "../utils/hash.js";
import type {
  AuditRecord,
  CanonicalEvent,
  CanonicalMode,
  ClassifierOutput,
  ScoreBundle,
  SkipReason,
  ThesisBundle,
  ValidationResult,
} from "./types.js";

import { writeFile, readFile, access, mkdir, appendFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { logError } from "../ops/logger.js";
import { incrementCounter, setGauge } from "../observability/metrics.js";
import { COUNTER_NAMES, GAUGE_NAMES } from "../observability/metricTypes.js";

import { DATA_DIR } from "../config/dataDir.js";

const AUDIT_DIR = DATA_DIR;
const AUDIT_FILE = join(AUDIT_DIR, "audit_log.jsonl");

// Buffer configuration
const FLUSH_INTERVAL_MS = 5000; // Flush every 5 seconds
const MAX_BUFFER_SIZE = 100; // Or when buffer reaches 100 entries

// In-memory buffer
const auditBuffer: AuditRecord[] = [];
let flushTimer: NodeJS.Timeout | null = null;
let isFlushing = false;

async function ensureDir(): Promise<void> {
  try {
    await access(AUDIT_DIR);
  } catch {
    await mkdir(AUDIT_DIR, { recursive: true });
  }
}

async function flushBuffer(): Promise<void> {
  if (isFlushing || auditBuffer.length === 0) return;

  isFlushing = true;
  const recordsToFlush = auditBuffer.splice(0, auditBuffer.length);

  try {
    await ensureDir();
    const lines = recordsToFlush.map((r) => JSON.stringify(r)).join("\n") + "\n";
    await appendFile(AUDIT_FILE, lines, "utf-8");
    incrementCounter(COUNTER_NAMES.AUDIT_FLUSH_SUCCESS_TOTAL);
  } catch (error) {
    auditBuffer.unshift(...recordsToFlush);
    incrementCounter(COUNTER_NAMES.AUDIT_FLUSH_FAILURE_TOTAL);
    logError("[auditLog] Failed to flush audit buffer", {
      error: error instanceof Error ? error.message : String(error),
      bufferedCount: recordsToFlush.length,
    });
  } finally {
    isFlushing = false;
    setGauge(GAUGE_NAMES.AUDIT_BUFFER_SIZE, auditBuffer.length);
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushBuffer().catch(() => {
      // Error already logged in flushBuffer
    });
  }, FLUSH_INTERVAL_MS);
}

export async function shutdownAuditLog(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushBuffer();
}

export function buildAuditRecord(params: {
  event: CanonicalEvent;
  cls: ClassifierOutput;
  scores: ScoreBundle;
  mode: CanonicalMode;
  thesis: ThesisBundle | null;
  prompt_hash: string | null;
  model_id: string;
  validation: ValidationResult | null;
  final_action: "publish" | "skip";
  skip_reason: SkipReason | null;
  reply_text: string | null;
  path?: "social" | "audit";
  eligibility_trace?: string[];
  policy_trace?: string[];
  detected_narrative?: string;
  selected_pattern?: string;
  response_mode?: string;
  energy_level?: import("./types.js").MarketEnergyLevel;
  slang_applied?: boolean;
}): AuditRecord {
  const eventSnapshot = JSON.stringify({
    event_id: params.event.event_id,
    text: params.event.text,
    author_handle: params.event.author_handle,
  });

  return {
    event_id: params.event.event_id,
    event_hash: stableHash(eventSnapshot),
    event_text: params.event.text,
    classifier_output: params.cls,
    score_bundle: params.scores,
    mode: params.mode,
    thesis: params.thesis,
    prompt_hash: params.prompt_hash,
    model_id: params.model_id,
    validation_result: params.validation,
    final_action: params.final_action,
    skip_reason: params.skip_reason,
    reply_text: params.reply_text,
    reply_hash: params.reply_text ? stableHash(params.reply_text) : null,
    created_at: new Date().toISOString(),
    path: params.path,
    eligibility_trace: params.eligibility_trace,
    policy_trace: params.policy_trace,
    detected_narrative: params.detected_narrative,
    selected_pattern: params.selected_pattern,
    response_mode: params.response_mode,
    energy_level: params.energy_level,
    slang_applied: params.slang_applied,
  };
}

export function getAuditBufferSize(): number {
  return auditBuffer.length;
}

export function persistAuditRecord(record: AuditRecord): void {
  auditBuffer.push(record);
  setGauge(GAUGE_NAMES.AUDIT_BUFFER_SIZE, auditBuffer.length);

  // Flush immediately if buffer is full
  if (auditBuffer.length >= MAX_BUFFER_SIZE) {
    flushBuffer().catch(() => {
      // Error already logged in flushBuffer
    });
  } else {
    scheduleFlush();
  }
}

export async function readAuditLog(): Promise<AuditRecord[]> {
  try {
    const content = await readFile(AUDIT_FILE, "utf-8");
    return content
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as AuditRecord);
  } catch (error) {
    // If file doesn't exist or other read error, return empty
    return [];
  }
}

// Graceful shutdown handler
process.on("SIGTERM", async () => {
  await shutdownAuditLog();
});

process.on("SIGINT", async () => {
  await shutdownAuditLog();
});
