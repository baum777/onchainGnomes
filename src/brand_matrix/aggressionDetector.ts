/**
 * Aggression Detector (brand_matrix)
 *
 * Detects insults, threats, excessive caps, repeated profanity.
 * Output: { isAggressive: boolean; signals: string[] }
 * Wraps safety/aggressionDetector for consistency.
 */

import {
  detectAggression as safetyDetect,
  type AggressionSignal,
} from "../safety/aggressionDetector.js";

export type AggressionResult = {
  isAggressive: boolean;
  signals: string[];
};

/**
 * Detect aggressive user input.
 * Aggressive => rhyme de-escalation override in humor mode selector.
 */
export function detectAggression(text: string): AggressionResult {
  const result: AggressionSignal = safetyDetect({ text });
  return {
    isAggressive: result.isAggressive,
    signals: result.reasons,
  };
}
