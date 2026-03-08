/**
 * Policy Tool - Agent-ready interface
 * 
 * Provides a simplified interface for the agent system to interact with policy adapters.
 */

import { policyTool } from "../adapters/policy/policyTool.js";
import type { 
  CAValidationResult, 
  SanitizeResult, 
  ToolResult, 
  Evidence, 
  ChainType,
  ToolErrorCode
} from "../types/tools.js";

/**
 * Creates evidence for policy tool results
 */
function createPolicyEvidence(notes: string): Evidence {
  return {
    source: "internal",
    timestamp: new Date().toISOString(),
    slot: null,
    signature: null,
    notes,
  };
}

/**
 * Policy Tool Interface
 */
export const policyToolInterface = {
  /**
   * Validates a contract address.
   */
  async validateCA(address: string, options?: { allowedChains?: ChainType[] }): Promise<ToolResult<CAValidationResult>> {
    const startTime = Date.now();
    try {
      const result = policyTool.validateCA(address, {
        allowedChains: options?.allowedChains,
        rejectTestPatterns: true,
      });

      return {
        success: result.valid,
        data: result,
        evidence: createPolicyEvidence(`Validated address: ${address}`),
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        evidence: null,
        error: {
          code: "UNEXPECTED" as ToolErrorCode,
          message: error instanceof Error ? error.message : "Unknown error in CA validation",
        },
        latencyMs: Date.now() - startTime,
      };
    }
  },

  /**
   * Sanitizes text to protect against identity spoofing and foreign addresses.
   */
  async sanitizeText(text: string, options?: { allowlist?: Set<string>, prompt?: string }): Promise<ToolResult<SanitizeResult>> {
    const startTime = Date.now();
    try {
      const result = policyTool.sanitizeText({
        text,
        allowlist: options?.allowlist,
        prompt: options?.prompt,
        policy: "strict",
      });

      return {
        success: true,
        data: result,
        evidence: createPolicyEvidence(`Sanitized text (length: ${text.length})`),
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        data: null,
        evidence: null,
        error: {
          code: "UNEXPECTED" as ToolErrorCode,
          message: error instanceof Error ? error.message : "Unknown error in text sanitization",
        },
        latencyMs: Date.now() - startTime,
      };
    }
  }
};
