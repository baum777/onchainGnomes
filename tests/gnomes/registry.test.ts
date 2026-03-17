/**
 * Gnome Registry Tests — Load and lookup gnome profiles
 */

import { describe, it, expect, beforeEach } from "vitest";
import { clearRegistry, getGnome, getAllGnomes, getFallbackChain } from "../../src/gnomes/registry.js";
import { loadGnomes } from "../../src/gnomes/loadGnomes.js";

describe("Gnome Registry", () => {
  beforeEach(() => {
    clearRegistry();
  });

  it("returns empty when no gnomes loaded", () => {
    expect(getAllGnomes()).toEqual([]);
  });

  it("loads gnomes from data/gnomes/*.yaml", async () => {
    const profiles = await loadGnomes();
    expect(profiles.length).toBeGreaterThanOrEqual(1);

    const firstId = profiles[0]?.id;
    expect(firstId).toBeDefined();
    if (!firstId) return;

    const loaded = getGnome(firstId);
    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe(firstId);
    expect(loaded?.name).toBeTruthy();
    expect(loaded?.role).toBeTruthy();
  });

  it("getFallbackChain returns configured defensive chain when available", async () => {
    await loadGnomes();
    const chain = getFallbackChain();
    expect(chain.slice(0, 3)).toEqual(["stillhalter", "wurzelwaechter", "muenzhueter"]);
  });

  it("getGnome is case-insensitive for loaded IDs", async () => {
    const profiles = await loadGnomes();
    const sampleId = profiles[0]?.id;
    expect(sampleId).toBeDefined();
    if (!sampleId) return;

    expect(getGnome(sampleId.toUpperCase())).toBeDefined();
    expect(getGnome(sampleId.toLowerCase())).toBeDefined();
  });
});
