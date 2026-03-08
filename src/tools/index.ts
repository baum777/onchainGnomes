/**
 * Tools Module - Index
 *
 * Central exports for the tool-call system including:
 * - ToolRegistry: Tool discovery and metadata
 * - ToolOrchestrator: Tool execution coordination
 * - Tool wrappers: High-level interfaces for each tool category
 */

// Re-export all types from types/tools.ts for convenience
export type {
  // Evidence & Results
  Evidence,
  EvidenceSource,
  ToolResult,
  ToolErrorCode,
  // Onchain Types
  TokenMintInfo,
  TokenAccountInfo,
  LargestAccountsInfo,
  SupplyInfo,
  Commitment,
  OnchainInput,
  // Market Types
  MarketQuote,
  MarketInput,
  MarketSource,
  MarketResult,
  // Policy Types
  SanitizeResult,
  TextModification,
  CAValidationResult,
  ChainType,
  SanitizePolicy,
  ModificationType,
  // Registry & Orchestrator
  ToolName,
  ToolDefinition,
  ToolRegistry,
  ToolCall,
  ToolExecutionPhase,
  OrchestratorConfig,
  ToolOrchestrator,
  PipelineContext,
} from "../types/tools.js";

// Export schemas for runtime validation
export {
  EvidenceSchema,
  EvidenceSourceSchema,
  ToolErrorCodeSchema,
  CommitmentSchema,
  OnchainInputSchema,
  MarketInputSchema,
  MarketSourceSchema,
  ChainTypeSchema,
  SanitizePolicySchema,
  ModificationTypeSchema,
  // Helper functions
  createEvidence,
  createErrorResult,
  createSuccessResult,
} from "../types/tools.js";
