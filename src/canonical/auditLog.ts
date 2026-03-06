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

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

const AUDIT_DIR = join(process.cwd(), "data");
const AUDIT_FILE = join(AUDIT_DIR, "audit_log.jsonl");

function ensureDir(): void {
  if (!existsSync(AUDIT_DIR)) {
    mkdirSync(AUDIT_DIR, { recursive: true });
  }
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
}): AuditRecord {
  const eventSnapshot = JSON.stringify({
    event_id: params.event.event_id,
    text: params.event.text,
    author_handle: params.event.author_handle,
  });

  return {
    event_id: params.event.event_id,
    event_hash: stableHash(eventSnapshot),
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
  };
}

export function persistAuditRecord(record: AuditRecord): void {
  try {
    ensureDir();
    const line = JSON.stringify(record) + "\n";
    writeFileSync(AUDIT_FILE, line, { flag: "a" });
  } catch {
    console.error("[auditLog] Failed to persist audit record for event:", record.event_id);
  }
}

export function readAuditLog(): AuditRecord[] {
  if (!existsSync(AUDIT_FILE)) return [];
  const content = readFileSync(AUDIT_FILE, "utf-8");
  return content
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as AuditRecord);
}
