/**
 * Repair Layer — Decision tree for post-validation repair.
 * Tries repair strategies when validation fails softly.
 */

import type {
  CanonicalMode,
  CanonicalConfig,
  ClassifierOutput,
  ValidationResult,
  RepairSuggestion,
} from "../canonical/types.js";
import { getHardMax } from "../canonical/modeBudgets.js";
import { validateResponse } from "../canonical/validator.js";
import { shortenText, neutralizePhrasing, swapCloser } from "./repairStrategies.js";

export interface RepairInput {
  draft: string;
  mode: CanonicalMode;
  cls: ClassifierOutput;
  config: CanonicalConfig;
  validation: ValidationResult;
}

export interface RepairOutput {
  repaired: string | null;
  strategy_used: RepairSuggestion | null;
  validation_after: ValidationResult | null;
}

/**
 * Attempt repair based on validation failure reason.
 * Returns repaired text if repair succeeds and passes validation, else null.
 */
export function attemptRepair(input: RepairInput): RepairOutput {
  const { draft, mode, cls, config, validation } = input;

  const suggestion = validation.repair_suggested;
  if (!suggestion) {
    return { repaired: null, strategy_used: null, validation_after: null };
  }

  let repaired: string;
  switch (suggestion) {
    case "shorten":
      repaired = shortenText(draft, mode);
      break;
    case "neutralize":
      repaired = neutralizePhrasing(draft);
      break;
    case "swap_closer":
      repaired = swapCloser(draft);
      break;
    case "regenerate":
      return { repaired: null, strategy_used: null, validation_after: null };
    default:
      return { repaired: null, strategy_used: null, validation_after: null };
  }

  const validationAfter = validateResponse(repaired, mode, cls, config);
  if (validationAfter.ok) {
    return { repaired, strategy_used: suggestion, validation_after: validationAfter };
  }

  return { repaired: null, strategy_used: suggestion, validation_after: validationAfter };
}
