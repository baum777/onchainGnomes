/**
 * Verification Module - Index
 *
 * Central exports for the verification pipeline system.
 */

export type {
  VerificationPipelineInput,
  VerificationPipelineOutput,
  VerificationContext,
  VerificationPhase,
  VerificationPipelineConfig,
  PolicyPhaseResult,
  OnchainPhaseResult,
  MarketPhaseResult,
  GuardCheckResult,
} from "./types.js";

export { DEFAULT_PIPELINE_CONFIG } from "./types.js";
