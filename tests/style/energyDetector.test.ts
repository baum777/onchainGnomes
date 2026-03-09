/**
 * Energy Detector Tests
 */

import { describe, it, expect } from "vitest";
import {
  calculateMarketEnergy,
  shouldActivateHornySlang,
  getEnergyStyleHints,
  type EnergySignals,
} from "../../src/style/energyDetector.js";

describe("calculateMarketEnergy", () => {
  it("returns LOW for minimal signals", () => {
    const signals: EnergySignals = {
      priceMovementPercent: 0.02,
      ctEngagementScore: 0.1,
      viralNarrativeScore: 0.1,
      memeManiaScore: 0.0,
      breakoutDetected: false,
    };
    expect(calculateMarketEnergy(signals)).toBe("LOW");
  });

  it("returns MEDIUM for moderate signals", () => {
    const signals: EnergySignals = {
      priceMovementPercent: 0.20,
      ctEngagementScore: 0.6,
      viralNarrativeScore: 0.5,
      memeManiaScore: 0.4,
      breakoutDetected: false,
    };
    expect(calculateMarketEnergy(signals)).toBe("MEDIUM");
  });

  it("returns HIGH for strong signals", () => {
    const signals: EnergySignals = {
      priceMovementPercent: 0.40,
      ctEngagementScore: 0.8,
      viralNarrativeScore: 0.7,
      memeManiaScore: 0.6,
      breakoutDetected: false,
    };
    expect(calculateMarketEnergy(signals)).toBe("HIGH");
  });

  it("returns EXTREME for maximum signals", () => {
    const signals: EnergySignals = {
      priceMovementPercent: 0.60,
      ctEngagementScore: 1.0,
      viralNarrativeScore: 0.9,
      memeManiaScore: 0.8,
      breakoutDetected: true,
    };
    expect(calculateMarketEnergy(signals)).toBe("EXTREME");
  });

  it("weighs breakout detection correctly", () => {
    const baseSignals: EnergySignals = {
      priceMovementPercent: 0.35,
      ctEngagementScore: 0.7,
      viralNarrativeScore: 0.6,
      memeManiaScore: 0.5,
      breakoutDetected: false,
    };
    
    const withoutBreakout = calculateMarketEnergy(baseSignals);
    const withBreakout = calculateMarketEnergy({ ...baseSignals, breakoutDetected: true });
    
    // Breakout should push from MEDIUM to HIGH
    expect(withoutBreakout).toBe("MEDIUM");
    expect(withBreakout).toBe("HIGH");
  });
});

describe("shouldActivateHornySlang", () => {
  it("returns false for LOW energy", () => {
    expect(shouldActivateHornySlang("LOW")).toBe(false);
  });

  it("returns false for MEDIUM energy", () => {
    expect(shouldActivateHornySlang("MEDIUM")).toBe(false);
  });

  it("returns true for HIGH energy", () => {
    expect(shouldActivateHornySlang("HIGH")).toBe(true);
  });

  it("returns true for EXTREME energy", () => {
    expect(shouldActivateHornySlang("EXTREME")).toBe(true);
  });
});

describe("getEnergyStyleHints", () => {
  it("returns dry hints for LOW energy", () => {
    const hints = getEnergyStyleHints("LOW");
    expect(hints).toContain("dry observation tone");
    expect(hints).toContain("minimal emotion");
  });

  it("returns sarcastic hints for MEDIUM energy", () => {
    const hints = getEnergyStyleHints("MEDIUM");
    expect(hints).toContain("sarcastic roast tone");
    expect(hints).toContain("subtle wit");
  });

  it("returns slang hints for HIGH energy", () => {
    const hints = getEnergyStyleHints("HIGH");
    expect(hints).toContain("playful slang mode");
    expect(hints).toContain("heat metaphors: hot, spicy, cooking");
    expect(hints).toContain("flirt metaphors: chart flirting, teasing levels");
  });

  it("returns unhinged hints for EXTREME energy", () => {
    const hints = getEnergyStyleHints("EXTREME");
    expect(hints).toContain("max meme energy");
    expect(hints).toContain("unhinged mode: ct absolutely unhinged");
    expect(hints).toContain("timeline going feral");
  });
});
