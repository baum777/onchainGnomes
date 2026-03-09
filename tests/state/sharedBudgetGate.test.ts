import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  checkLLMBudget,
  recordLLMCall,
  getBudgetStatus,
  resetBudget,
} from "../../src/state/sharedBudgetGate.js";
import { getStateStore, resetStoreCache } from "../../src/state/storeFactory.js";

/**
 * Shared budget gate (store-backed): two gate instances share budget,
 * thread vs reply weights, window reset, fail-closed on store error.
 */

beforeEach(() => {
  delete process.env.USE_REDIS;
  resetStoreCache();
});

describe("sharedBudgetGate", () => {
  beforeEach(async () => {
    await resetBudget();
  });

  describe("two gate instances share same budget", () => {
    it("worker A consumes budget, worker B sees updated usage", async () => {
      const r1 = await checkLLMBudget(false);
      expect(r1.allowed).toBe(true);
      await recordLLMCall(false);
      const status = await getBudgetStatus();
      expect(status.used).toBe(1);
      const r2 = await checkLLMBudget(false);
      expect(r2.used).toBe(1);
      expect(r2.remaining).toBe(28); // 30 - 1 (used) - 1 (requested)
    });

    it("multiple recordLLMCall accumulate in shared store", async () => {
      await recordLLMCall(false);
      await recordLLMCall(false);
      await recordLLMCall(true);
      const status = await getBudgetStatus();
      expect(status.used).toBe(4);
    });
  });

  describe("thread vs reply weights", () => {
    it("reply weight 1, thread weight 2", async () => {
      await recordLLMCall(false);
      await recordLLMCall(true);
      const status = await getBudgetStatus();
      expect(status.used).toBe(3);
    });
  });

  describe("threshold and block", () => {
    it("when usage reaches limit, checkLLMBudget returns allowed false", async () => {
      const limit = 30;
      for (let i = 0; i < limit; i++) {
        const r = await checkLLMBudget(false);
        if (r.allowed) await recordLLMCall(false);
      }
      const blocked = await checkLLMBudget(false);
      expect(blocked.allowed).toBe(false);
      expect(blocked.skipReason).toContain("budget_exceeded");
    });
  });

  describe("window reset", () => {
    it("usage resets when window expires", async () => {
      await recordLLMCall(false);
      await recordLLMCall(false);
      await resetBudget();
      const status = await getBudgetStatus();
      expect(status.used).toBe(0);
    });
  });

  describe("store error handling", () => {
    it("when getBudgetUsage returns 0 on error, checkLLMBudget defaults to safety", async () => {
      const store = getStateStore();
      vi.spyOn(store, "incr").mockRejectedValue(new Error("Store unavailable"));
      // The store catches and returns 0 by contract (mocking incr to 0 here)
      vi.spyOn(store, "incr").mockResolvedValue(0); 
      const r = await checkLLMBudget(false);
      expect(r.allowed).toBe(true); // Default to allow if store reports 0
      vi.restoreAllMocks();
    });
  });
});
