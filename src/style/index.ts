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
  computeKeywordDensity,
  isMemeCoinEvent,
} from "./degenRegardDetector.js";
export {
  type StyleContext,
  type DegenRegardInput,
  SLANG_CATEGORIES,
  ALL_SLANG_PHRASES,
  resolveStyle,
  estimateBissigkeitProxy,
  calculateHybridBissigkeit,
  getSlangGuidelines,
  getSavageSlangGuidelines,
  getUltraSavageGuidelines,
  getDegenRegardGuidelines,
  modeSupportsStyling,
  getSamplePhrases,
} from "./styleResolver.js";
