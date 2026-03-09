/**
 * Style Module — Horny-Slang Energy Mode
 * 
 * Exports energy detection and style resolution for the
 * horny_slang_energy stylistic trait.
 */

export {
  type MarketEnergyLevel,
  type EnergySignals,
  calculateMarketEnergy,
  shouldActivateHornySlang,
  extractEnergySignals,
  getEnergyStyleHints,
} from "./energyDetector.js";

export {
  type StyleContext,
  SLANG_CATEGORIES,
  ALL_SLANG_PHRASES,
  resolveStyle,
  getSlangGuidelines,
  modeSupportsStyling,
  getSamplePhrases,
} from "./styleResolver.js";
