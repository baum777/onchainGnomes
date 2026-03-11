import { describe, it, expect } from "vitest";
import { LoreMemorySchema, LoreDeltaResultSchema } from "../../src/types/coreTypes.js";
import { parseWithZod } from "../_helpers/zodHarness.js";
import { mockLLM } from "../_mocks/mockLLM.js";

function applyLoreDeltas(loreMemory: unknown, deltas: unknown) {
  const mem = parseWithZod(LoreMemorySchema, loreMemory);
  const d = parseWithZod(LoreDeltaResultSchema, deltas);

  if (!d.should_write) return mem;

  const next = { ...mem, entries: [...mem.entries] };
  for (const delta of d.lore_deltas) {
    const idx = next.entries.findIndex((e) => e.key === delta.key);
    if (idx === -1) {
      next.entries.push({
        key: delta.key,
        canon: delta.canon_or_headcanon === "canon" ? delta.text : undefined,
        headcanon: delta.canon_or_headcanon === "headcanon" ? [delta.text] : [],
      });
    } else {
      const entry = next.entries[idx];
      if (delta.canon_or_headcanon === "canon") {
        next.entries[idx] = { ...entry, canon: delta.text };
      } else {
        next.entries[idx] = {
          ...entry,
          headcanon: [...(entry.headcanon ?? []), delta.text],
        };
      }
    }
  }
  return parseWithZod(LoreMemorySchema, next);
}

describe("Lore writeback: two-run consistency contract", () => {
  it("lore additions persist and are retrievable for future runs", () => {
    const initialLore = { entries: [] };

    // Run 1: lore query produces deltas
    const deltas1 = mockLLM.loreDelta("lore_query", "LORE", "From the liquidity void...");
    const lore1 = applyLoreDeltas(initialLore, deltas1);

    expect(lore1.entries.length).toBeGreaterThan(0);

    // Run 2: pretend the bot sees stored lore now
    const origin = lore1.entries.find((e) => e.key === "GORKY_ON_SOL.origin")?.canon;
    expect(origin).toBeTruthy();

    // Ensure no contradiction pattern: canon is stable (contract check)
    const deltas2 = mockLLM.loreDelta("lore_query", "LORE", "Tell me your origin again.");
    const lore2 = applyLoreDeltas(lore1, deltas2);

    const origin2 = lore2.entries.find((e) => e.key === "GORKY_ON_SOL.origin")?.canon;
    expect(origin2).toBe(origin); // canon should not drift
  });
});
