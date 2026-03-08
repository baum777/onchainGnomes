/**
 * Policy Adapters - Index
 * 
 * Exports all policy-related adapters for address validation and sanitization.
 */

export {
  validateCA,
  detectChainType,
  strictAddressGate,
  type ValidateCAOptions,
} from "./caValidator.js";

export {
  addressGateSanitize,
  detectSpoofContext,
  generateDeterministicDecoy,
  extractAddressesFromText,
  type AddressGateSanitizeOptions,
} from "./addressSanitizer.js";
