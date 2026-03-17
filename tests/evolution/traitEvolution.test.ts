/**
 * Phase-3: Trait evolution engine tests
 */
import { describe, it, expect } from "vitest";
import {
  applyEvolutionSignals,
  type EvolvedTrait,
} from "../../src/evolution/traitEvolutionEngine.js";
import { validateTraitBounds } from "../../src/evolution/traitBoundsValidator.js";
import { checkPersonaIntegrity } from "../../src/evolution/personaIntegrityGuard.js";

describe("traitEvolutionEngine", () => {
  it("returns empty when disabled", () => {
    const signals = [
      { gnome_id: "gorky", trait_key: "sarcasm", direction: "up" as const, magnitude: 0.1, evidence: [], timestamp: new Date().toISOString() },
    ];
    const result = applyEvolutionSignals(signals, { sarcasm: 0.8 }, { sarcasm: { min: 0, max: 1, driftLimitPer100: 0.25 } }, { enabled: false });
    expect(result).toHaveLength(0);
  });

  it("applies signals within bounds", () => {
    const signals = [
      { gnome_id: "gorky", trait_key: "sarcasm", direction: "up" as const, magnitude: 0.2, evidence: [], timestamp: new Date().toISOString() },
    ];
    const result = applyEvolutionSignals(signals, { sarcasm: 0.6 }, { sarcasm: { min: 0, max: 1, driftLimitPer100: 0.25 } }, { enabled: true });
    expect(result).toHaveLength(1);
    expect(result[0].gnome_id).toBe("gorky");
    expect(result[0].trait_key).toBe("sarcasm");
    expect(result[0].old_value).toBe(0.6);
    expect(result[0].new_value).toBeGreaterThan(0.6);
    expect(result[0].new_value).toBeLessThanOrEqual(1);
  });
});

describe("traitBoundsValidator", () => {
  it("rejects below min", () => {
    const r = validateTraitBounds(-0.1, 0.5, { min: 0, max: 1, driftLimitPer100: 0.25 });
    expect(r.valid).toBe(false);
    expect(r.clamped).toBe(0);
  });

  it("rejects above max", () => {
    const r = validateTraitBounds(1.1, 0.5, { min: 0, max: 1, driftLimitPer100: 0.25 });
    expect(r.valid).toBe(false);
    expect(r.clamped).toBe(1);
  });

  it("accepts valid drift", () => {
    const r = validateTraitBounds(0.6, 0.5, { min: 0, max: 1, driftLimitPer100: 0.25 });
    expect(r.valid).toBe(true);
  });

  it("clamps excessive drift", () => {
    const r = validateTraitBounds(0.9, 0.5, { min: 0, max: 1, driftLimitPer100: 0.25 });
    expect(r.valid).toBe(false);
    expect(r.clamped).toBe(0.75);
  });
});

describe("personaIntegrityGuard", () => {
  it("rejects taboo traits", () => {
    const r = checkPersonaIntegrity([{ trait_key: "aggression", direction: "up", magnitude: 0.1 }], "gorky");
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("taboo_trait");
  });

  it("rejects high magnitude", () => {
    const r = checkPersonaIntegrity([{ trait_key: "sarcasm", direction: "up", magnitude: 0.6 }], "gorky");
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("magnitude_too_high");
  });

  it("allows safe signals", () => {
    const r = checkPersonaIntegrity([{ trait_key: "sarcasm", direction: "up", magnitude: 0.1 }], "gorky");
    expect(r.allowed).toBe(true);
  });
});
