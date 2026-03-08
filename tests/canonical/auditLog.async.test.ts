import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildAuditRecord,
  persistAuditRecord,
  readAuditLog,
  shutdownAuditLog,
} from "../../src/canonical/auditLog.js";
import { DEFAULT_CANONICAL_CONFIG } from "../../src/canonical/types.js";
import type { CanonicalEvent, ClassifierOutput, ScoreBundle } from "../../src/canonical/types.js";
import fs from "node:fs";
import path from "node:path";

const AUDIT_FILE = path.join(process.cwd(), "data", "audit_log.jsonl");

function makeEvent(id = "audit_test_1"): CanonicalEvent {
  return {
    event_id: id,
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

describe("1.4 Async Audit Logging", () => {
  beforeEach(async () => {
    // Clean up and ensure fresh state
    if (fs.existsSync(AUDIT_FILE)) {
      fs.unlinkSync(AUDIT_FILE);
    }
    // Reset any internal buffer state by forcing a shutdown
    await shutdownAuditLog();
  });

  afterEach(async () => {
    await shutdownAuditLog();
    if (fs.existsSync(AUDIT_FILE)) {
      fs.unlinkSync(AUDIT_FILE);
    }
  });

  describe("Buffer flush behavior", () => {
    it("persists records to file", async () => {
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
      await shutdownAuditLog(); // Force flush

      const logs = await readAuditLog();
      expect(logs.length).toBe(1);
      expect(logs[0].event_id).toBe("audit_test_1");
    });

    it("appends multiple records", async () => {
      for (let i = 0; i < 3; i++) {
        const record = buildAuditRecord({
          event: makeEvent(`audit_test_${i}`),
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

  describe("Audit record structure", () => {
    it("builds a complete audit record with all fields", async () => {
      const record = buildAuditRecord({
        event: makeEvent(),
        cls: makeCls(),
        scores: makeScores(),
        mode: "dry_one_liner",
        thesis: { primary: "claim_exceeds_evidence", supporting_point: null, evidence_bullets: [] },
        prompt_hash: "abc123",
        model_id: "grok-3",
        validation: {
          ok: true,
          reason: "passed",
          checks: {
            char_limit: true,
            identity_attack: true,
            financial_advice: true,
            wallet_filter: true,
            unsupported_assertion: true,
            mode_match: true,
            persona_compliance: true,
          },
        },
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
      expect(record.classifier_output).toBeDefined();
      expect(record.score_bundle).toBeDefined();
    });

    it("handles skip records without reply_text", async () => {
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

      expect(record.reply_text).toBeNull();
      expect(record.reply_hash).toBeNull();
    });
  });

  describe("Graceful shutdown", () => {
    it("flushes remaining buffer on shutdown", async () => {
      const record = buildAuditRecord({
        event: makeEvent("shutdown_test"),
        cls: makeCls(),
        scores: makeScores(),
        mode: "ignore",
        thesis: null,
        prompt_hash: null,
        model_id: "grok-3",
        validation: null,
        final_action: "skip",
        skip_reason: "test",
        reply_text: null,
      });

      persistAuditRecord(record);
      await shutdownAuditLog();

      const logs = await readAuditLog();
      expect(logs.length).toBe(1);
      expect(logs[0].event_id).toBe("shutdown_test");
    });
  });
});
