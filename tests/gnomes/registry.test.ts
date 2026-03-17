/**
 * Gnome Registry Tests — Load and lookup gnome profiles
 */

import { describe, it, expect, beforeEach } from "vitest";
import { join } from "node:path";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { clearRegistry, getGnome, getAllGnomes, getFallbackChain } from "../../src/gnomes/registry.js";
import { loadGnomes } from "../../src/gnomes/loadGnomes.js";

const TEST_DATA_DIR = join(process.cwd(), "data", "gnomes");

describe("Gnome Registry", () => {
  beforeEach(() => {
    clearRegistry();
  });

  it("returns empty when no gnomes loaded", () => {
    expect(getAllGnomes()).toEqual([]);
    expect(getGnome("gorky")).toBeUndefined();
  });

  it("loads gnomes from data/gnomes/*.yaml", async () => {
    const profiles = await loadGnomes();
    expect(profiles.length).toBeGreaterThanOrEqual(1);
    const gorky = getGnome("gorky");
    expect(gorky).toBeDefined();
    expect(gorky?.id).toBe("gorky");
    expect(gorky?.name).toBe("GORKY");
    expect(gorky?.role).toBeDefined();
  });

  it("getFallbackChain returns gorky when present", async () => {
    await loadGnomes();
    const chain = getFallbackChain();
    expect(chain).toContain("gorky");
  });

  it("getGnome is case-insensitive", async () => {
    await loadGnomes();
    expect(getGnome("GORKY")).toBeDefined();
    expect(getGnome("gorky")).toBeDefined();
  });
});
