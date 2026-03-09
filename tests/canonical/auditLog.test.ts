import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildAuditRecord, persistAuditRecord, readAuditLog, shutdownAuditLog } from "../../src/canonical/auditLog.js";
import { DEFAULT_CANONICAL_CONFIG } from "../../src/canonical/types.js";
import type { CanonicalEvent, ClassifierOutput, ScoreBundle } from "../../src/canonical/types.js";
import fs from "node:fs";
import path from "node:path";

const AUDIT_FILE = path.join(process.cwd(), "data", "audit_log.jsonl");

function makeEvent(): CanonicalEvent {
  return {
    event_id: "audit_test_1",
    platform: "twitter",
    trigger_type: "mention",
    author_handle: "@auditor",
    author_id: "aud_1",
    text: "Test text for audit",
    parent_text: null,
    quoted_text: null,
    conversation_context: [],
    cashtags: [],
    hashtags: [],
    urls: [],
    timestamp: new Date().toISOString(),
  };
}

function makeCls(): ClassifierOutput {
  return {
    intent: "hype_claim",
    target: "claim",
    evidence_class: "contextual_medium",
    bait_probability: 0.1,
    spam_probability: 0.05,
    policy_blocked: false,
    evidence_bullets: [],
    risk_flags: [],
  };
}

function makeScores(): ScoreBundle {
  return { relevance: 0.7, confidence: 0.6, severity: 0.5, opportunity: 0.6, risk: 0.2, novelty: 0.7 };
}

describe("auditLog", () => {
  beforeEach(async () => {
    if (fs.existsSync(AUDIT_FILE)) {
      fs.unlinkSync(AUDIT_FILE);
    }
    await shutdownAuditLog();
  });

  afterEach(async () => {
    await shutdownAuditLog();
    if (fs.existsSync(AUDIT_FILE)) {
      fs.unlinkSync(AUDIT_FILE);
    }
  });

  it("builds a complete audit record", () => {
    const record = buildAuditRecord({
      event: makeEvent(),
      cls: makeCls(),
      scores: makeScores(),
      mode: "dry_one_liner",
      thesis: { primary: "claim_exceeds_evidence", supporting_point: null, evidence_bullets: [] },
      prompt_hash: "abc123",
      model_id: "grok-3",
      validation: { ok: true, reason: "passed", checks: { char_limit: true, identity_attack: true, financial_advice: true, wallet_filter: true, unsupported_assertion: true, mode_match: true, persona_compliance: true } },
      final_action: "publish",
      skip_reason: null,
      reply_text: "Nice hype.",
    });

    expect(record.event_id).toBe("audit_test_1");
    expect(record.event_hash).toBeTruthy();
    expect(record.mode).toBe("dry_one_liner");
    expect(record.final_action).toBe("publish");
    expect(record.reply_hash).toBeTruthy();
    expect(record.created_at).toBeTruthy();
  });

  it("persists and reads back audit records", async () => {
    const record = buildAuditRecord({
      event: makeEvent(),
      cls: makeCls(),
      scores: makeScores(),
      mode: "ignore",
      thesis: null,
      prompt_hash: null,
      model_id: "grok-3",
      validation: null,
      final_action: "skip",
      skip_reason: "skip_low_relevance",
      reply_text: null,
    });

    persistAuditRecord(record);
    await shutdownAuditLog();
    const logs = await readAuditLog();
    expect(logs.length).toBe(1);
    expect(logs[0].event_id).toBe("audit_test_1");
    expect(logs[0].final_action).toBe("skip");
    expect(logs[0].skip_reason).toBe("skip_low_relevance");
  });

  it("appends multiple records", async () => {
    for (let i = 0; i < 3; i++) {
      const record = buildAuditRecord({
        event: { ...makeEvent(), event_id: `audit_test_${i}` },
        cls: makeCls(),
        scores: makeScores(),
        mode: "ignore",
        thesis: null,
        prompt_hash: null,
        model_id: "grok-3",
        validation: null,
        final_action: "skip",
        skip_reason: "skip_duplicate",
        reply_text: null,
      });
      persistAuditRecord(record);
    }
    await shutdownAuditLog();
    const logs = await readAuditLog();
    expect(logs.length).toBe(3);
  });

  it("returns empty array when no log file exists", async () => {
    const logs = await readAuditLog();
    expect(logs).toEqual([]);
  });
});
