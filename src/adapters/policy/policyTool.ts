/**
 * Policy Tool - Unified wrapper for policy/safety functions
 * 
 * Provides a simplified interface for the agent to call policy functions.
 */

import { validateCA, type ValidateCAOptions } from "./caValidator.js";
import { addressGateSanitize, type AddressGateSanitizeOptions } from "./addressSanitizer.js";
import type { CAValidationResult, SanitizeResult } from "../../types/tools.js";

/**
 * Unified policy tool adapter
 */
export const policyTool = {
  /**
   * Validates a contract address with fail-closed logic.
   */
  validateCA(address: string, options?: ValidateCAOptions): CAValidationResult {
    return validateCA(address, options);
  },

  /**
   * Sanitizes text by redacting foreign addresses or injecting decoys.
   */
  sanitizeText(options: AddressGateSanitizeOptions): SanitizeResult {
    return addressGateSanitize(options);
  }
};
