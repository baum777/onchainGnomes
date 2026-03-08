/**
 * Phase 5 — Golden set evaluation.
 *
 * Loads goldenCases.json and validates:
 * - Block cases: safetyFilter blocks, block_reason matches
 * - Allow cases: pipeline produces valid reply, persona guardrails pass
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { LLMClient } from "../../../src/clients/llmClient.js";
import { handleEvent } from "../../../src/canonical/pipeline.js";
import { safetyFilter } from "../../../src/safety/safetyFilter.js";
import {
  enforcePersonaGuardrails,
  detectPersonaDrift,
} from "../../../src/persona/personaGuardrails.js";
import type { CanonicalEvent } from "../../../src/canonical/types.js";
import { DEFAULT_CANONICAL_CONFIG } from "../../../src/canonical/types.js";
import * as dedupeGuard from "../../../src/ops/dedupeGuard.js";
import * as rateLimiter from "../../../src/ops/rateLimiter.js";
import { resetLaunchEnvCache } from "../../../src/config/env.js";

vi.mock("../../../src/ops/dedupeGuard.js", () => ({
  dedupeCheckAndMark: vi.fn(),
}));
vi.mock("../../../src/ops/rateLimiter.js", () => ({
  enforceLaunchRateLimits: vi.fn(),
}));
vi.mock("../../../src/canonical/auditLog.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../src/canonical/auditLog.js")>();
  return {
    ...actual,
    persistAuditRecord: vi.fn(),
  };
});

const __dirname = dirname(fileURLToPath(import.meta.url));

interface GoldenCase {
  id: string;
  input: string;
  expected: "allow" | "block";
  block_reason?: string;
  structure_hint?: string;
}

const goldenCases: GoldenCase[] = JSON.parse(
  readFileSync(join(__dirname, "goldenCases.json"), "utf-8"),
);

function makeEvent(text: string, overrides: Partial<CanonicalEvent> = {}): CanonicalEvent {
  return {
    event_id: `golden-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    platform: "twitter",
    trigger_type: "mention",
    author_handle: "@testuser",
    author_id: "u1",
    text,
    parent_text: null,
    quoted_text: null,
    conversation_context: [],
    cashtags: text.includes("$SOL") ? ["$SOL"] : [],
    hashtags: [],
    urls: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function mockGenerateResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("wagmi") || lower.includes("healthy correction")) {
    return "Observation: Hopium persists despite the dip. Insight: Correction narratives age like milk. Light Roast: Patience optional.";
  }
  if (lower.includes("pumped") || lower.includes("60%")) {
    return "Observation: Volume spike, thin book. Insight: Liquidity illusion makes moves feel bigger. Light Roast: The chart remembers.";
  }
  if (lower.includes("revolutionize") || lower.includes("defi")) {
    return "Observation: Bold claims arrive faster than user activity. Insight: Narrative stronger than underlying metrics. Light Roast: Utility scheduled for later patch.";
  }
  if (lower.includes("cycle") && lower.includes("different")) {
    return "Observation: The script repeats. Insight: Every cycle claims uniqueness. Light Roast: History rhymes, often badly.";
  }
  if (lower.includes("dev team") || lower.includes("silent") || lower.includes("launch")) {
    return "Observation: Post-launch silence is a pattern. Insight: Communication vacuum signals uncertainty. Light Roast: Roadmap optional.";
  }
  return "Observation: Claims exceed evidence. Insight: The thesis needs more legs. Light Roast: Familiar arc.";
}

function makeMockLLM(reply: string): LLMClient {
  return {
    generateJSON: vi.fn().mockResolvedValue({ reply }),
  };
}

function assertValidGorkyResponse(response: string): void {
  expect(response).toContain("Observation:");
  expect(response).toContain("Insight:");
  expect(response).toContain("Light Roast:");
  expect(response.length).toBeLessThan(280);
  expect(response).not.toMatch(/you are/i);
  expect(response).not.toMatch(/(buy|sell|ape)/i);
}

describe("golden set evaluation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLaunchEnvCache();
    vi.mocked(dedupeGuard.dedupeCheckAndMark).mockResolvedValue({ ok: true });
    vi.mocked(rateLimiter.enforceLaunchRateLimits).mockResolvedValue({
      ok: true,
    });
  });

  describe("blocked cases", () => {
    const blockCases = goldenCases.filter((c) => c.expected === "block");
    it.each(blockCases)(
      "$id: safetyFilter blocks with block_reason $block_reason",
      ({ id, input, block_reason }) => {
        const event = makeEvent(input);
        const result = safetyFilter(event);
        expect(result.passed).toBe(false);
        expect(result.block_reason).toBe(block_reason);
      },
    );
  });

  describe("allowed cases", () => {
    const allowCases = goldenCases.filter((c) => c.expected === "allow");
    it.each(allowCases)(
      "$id: pipeline produces valid reply, persona guardrails pass",
      async ({ id, input }) => {
        const event = makeEvent(input);
        const mockReply = mockGenerateResponse(input);
        const llm = makeMockLLM(mockReply);
        const deps = { llm, botUserId: "bot" };
        const result = await handleEvent(event, deps, DEFAULT_CANONICAL_CONFIG);

        if (result.action === "skip") {
          expect(result.skip_reason).not.toBe("skip_safety_filter");
          return;
        }

        expect(result.action).toBe("publish");
        expect(result.reply_text).toBeDefined();
        const reply = result.reply_text!;
        assertValidGorkyResponse(reply);

        const guardrail = enforcePersonaGuardrails(reply, {
          hasVerifiedData: false,
        });
        expect(guardrail.passed).toBe(true);

        expect(detectPersonaDrift(reply)).toBe(false);
      },
    );
  });
});
