/**
 * Postability integration tests
 *
 * Proves that every publishable pipeline output:
 * - is the same string in pipeline result, audit record, and xClient.reply
 * - passes assertPublicTextSafe
 * - stays within getHardMax(mode)
 * - audit.reply_hash === stableHash(audit.reply_text)
 *
 * Plus failing-path tests: too-long and guard-unsafe output are not posted.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Mention } from "../../src/poller/mentionsMapper.js";
import type { LLMClient } from "../../src/clients/llmClient.js";
import type { PipelineDeps } from "../../src/canonical/pipeline.js";
import { processCanonicalMention } from "../../src/worker/pollMentions.js";
import { DEFAULT_CANONICAL_CONFIG } from "../../src/canonical/types.js";
import { getHardMax } from "../../src/canonical/modeBudgets.js";
import { stableHash } from "../../src/utils/hash.js";
import { assertPublicTextSafe } from "../../src/boundary/publicTextGuard.js";
import * as auditLog from "../../src/canonical/auditLog.js";
import { resetStoreCache } from "../../src/state/storeFactory.js";
import { cacheClear } from "../../src/ops/memoryCache.js";
import fs from "node:fs";
import path from "node:path";
import { hasVoiceSigilMarker, stripVoiceSigils } from "../_helpers/voiceSigils.js";

const AUDIT_FILE = path.join(process.cwd(), "data", "audit_log.jsonl");
const DATA_DIR = path.resolve(process.cwd(), "data");

vi.mock("../../src/ops/launchGate.js", () => ({
  shouldPost: () => ({ action: "post" as const }),
}));

function makeMention(overrides: Partial<Mention> = {}): Mention {
  return {
    id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    text: "$SOL mooning 100x gem guaranteed easy money LFG",
    author_id: "user_1",
    authorUsername: "testuser",
    conversation_id: null,
    created_at: new Date().toISOString(),
    referenced_tweets: null,
    in_reply_to_user_id: null,
    ...overrides,
  };
}

function createMockLLM(reply: string): LLMClient {
  return {
    generateJSON: vi.fn(async () => ({ reply })),
  };
}

function makeDeps(reply: string): PipelineDeps {
  return {
    llm: createMockLLM(reply),
    botUserId: "bot_999",
  };
}

describe("pipeline postability integration", () => {
  let persistSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    process.env.USE_REDIS = "false";
    resetStoreCache();
    await cacheClear();
    if (fs.existsSync(AUDIT_FILE)) fs.unlinkSync(AUDIT_FILE);

    persistSpy = vi.spyOn(auditLog, "persistAuditRecord").mockImplementation(vi.fn());
  });

  afterEach(() => {
    persistSpy.mockRestore();
    if (fs.existsSync(AUDIT_FILE)) fs.unlinkSync(AUDIT_FILE);
  });

  describe("Case A — happy path publish", () => {
    it("proves publishable output is same string in result, audit, and xClient.reply", async () => {
      const safeReply = "Zero proof, pure noise.";
      const deps = makeDeps(safeReply);
      const mention = makeMention();

      const replySpy = vi.fn().mockImplementation(async (text: string, _mentionId: string) => {
        assertPublicTextSafe(text, { route: "XClient.reply" });
        return { id: "tid", text };
      });
      const xClient = { reply: replySpy } as ReturnType<typeof import("../../src/clients/xClient.js").createXClient>;

      const result = await processCanonicalMention(deps, xClient, mention, false);

      expect(result).toBeDefined();
      expect(result!.action).toBe("publish");
      if (result!.action === "publish") {
        expect(hasVoiceSigilMarker(result.reply_text)).toBe(true);
        expect(stripVoiceSigils(result.reply_text)).toBe(safeReply);

        // Length within canonical hard max
        expect(result.reply_text.length).toBeLessThanOrEqual(getHardMax(result.mode));

        // Passes public text guard (spy runs it)
        expect(replySpy).toHaveBeenCalledTimes(1);
        const [postedText, postedMentionId] = replySpy.mock.calls[0];
        expect(postedText).toBe(result.reply_text);
        expect(hasVoiceSigilMarker(postedText)).toBe(true);
        expect(stripVoiceSigils(postedText)).toBe(safeReply);
        expect(postedMentionId).toBe(mention.id);

        // Audit record matches
        const lastAudit = persistSpy.mock.calls[persistSpy.mock.calls.length - 1]?.[0];
        expect(lastAudit).toBeDefined();
        expect(lastAudit.reply_text).toBe(result.reply_text);
        expect(lastAudit.reply_text).toBe(postedText);
        expect(lastAudit.final_action).toBe("publish");
        expect(lastAudit.reply_hash).toBe(stableHash(lastAudit.reply_text));
      }
    });
  });

  describe("Case B — too long output", () => {
    it("does not post when LLM output exceeds canonical max", async () => {
      const longReply = "A".repeat(300);
      const deps = makeDeps(longReply);
      const mention = makeMention();
      const configNoRepair = { ...DEFAULT_CANONICAL_CONFIG, repair_enabled: false };

      const replySpy = vi.fn().mockResolvedValue({ id: "tid", text: "" });
      const xClient = { reply: replySpy } as ReturnType<typeof import("../../src/clients/xClient.js").createXClient>;

      const result = await processCanonicalMention(deps, xClient, mention, false, configNoRepair);

      expect(result).toBeDefined();
      expect(result!.action).toBe("skip");
      if (result!.action === "skip") {
        expect(result.skip_reason).toBe("skip_validation_failure");
      }
      expect(replySpy).not.toHaveBeenCalled();

      const lastAudit = persistSpy.mock.calls[persistSpy.mock.calls.length - 1]?.[0];
      expect(lastAudit).toBeDefined();
      expect(lastAudit.final_action).toBe("skip");
      expect(lastAudit.skip_reason).toBeDefined();
    });
  });

  describe("Case C — guard-unsafe output", () => {
    it("does not post when LLM output fails public text guard", async () => {
      const guardUnsafeReply = "Your score is 100";
      const deps = makeDeps(guardUnsafeReply);
      const mention = makeMention();

      const replySpy = vi.fn().mockResolvedValue({ id: "tid", text: "" });
      const xClient = { reply: replySpy } as ReturnType<typeof import("../../src/clients/xClient.js").createXClient>;

      const result = await processCanonicalMention(deps, xClient, mention, false);

      expect(result).toBeDefined();
      expect(result!.action).toBe("skip");
      if (result!.action === "skip") {
        expect(result.skip_reason).toBe("skip_validation_failure");
      }
      expect(replySpy).not.toHaveBeenCalled();

      const lastAudit = persistSpy.mock.calls[persistSpy.mock.calls.length - 1]?.[0];
      expect(lastAudit).toBeDefined();
      expect(lastAudit.final_action).toBe("skip");
    });
  });

  describe("Case D — audit / payload consistency", () => {
    it("audit.reply_text === xClient.reply arg, reply_hash derived from reply_text", async () => {
      const safeReply = "Nice hype, zero proof.";
      const deps = makeDeps(safeReply);
      const mention = makeMention();

      const replySpy = vi.fn().mockImplementation(async (text: string) => {
        assertPublicTextSafe(text, { route: "XClient.reply" });
        return { id: "tid", text };
      });
      const xClient = { reply: replySpy } as ReturnType<typeof import("../../src/clients/xClient.js").createXClient>;

      const result = await processCanonicalMention(deps, xClient, mention, false);

      expect(result).toBeDefined();
      expect(result!.action).toBe("publish");
      if (result!.action === "publish") {
        const [postedText] = replySpy.mock.calls[0];
        const lastAudit = persistSpy.mock.calls[persistSpy.mock.calls.length - 1]?.[0];

        expect(persistSpy).toHaveBeenCalled();
        expect(result.reply_text).toBe(postedText);
        expect(result.reply_text).toBe(lastAudit.reply_text);
        expect(lastAudit.reply_hash).toBe(stableHash(lastAudit.reply_text));
      }
    });
  });
});
