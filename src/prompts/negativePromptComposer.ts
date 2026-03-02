/**
 * Negative Prompt Composer
 *
 * Two-stage negative prompt composition:
 * 1. Global Guards (always)
 * 2. Preset Guards (from YAML)
 * 3. Safety Guards (from policy)
 */

import { GLOBAL_NEGATIVE_GUARDS } from "./styleBands.js";

export type NegativePromptStage = {
  global: string[];
  preset: string[];
  safety: string[];
};

/**
 * Compose negative prompt from all three stages
 */
export function composeNegativePrompt(
  presetNegative?: string,
  safetyFlags?: string[]
): string {
  const parts: string[] = [...GLOBAL_NEGATIVE_GUARDS];

  // Stage 2: Preset Guards (from YAML)
  if (presetNegative) {
    const presetParts = presetNegative
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    parts.push(...presetParts);
  }

  // Stage 3: Safety Guards (from policy output)
  if (safetyFlags && safetyFlags.length > 0) {
    const safetyParts = buildSafetyNegative(safetyFlags);
    parts.push(...safetyParts);
  }

  // Remove duplicates while preserving order
  const uniqueParts = [...new Set(parts)];

  return uniqueParts.join(", ");
}

/**
 * Build safety-specific negative terms from policy flags
 */
function buildSafetyNegative(flags: string[]): string[] {
  const safetyNegatives: string[] = [];

  for (const flag of flags) {
    // Direct unsafe content markers
    if (flag.startsWith("unsafe:")) {
      const content = flag.replace("unsafe:", "").trim();
      if (content) {
        safetyNegatives.push(content);
      }
    }

    // Risky content
    if (flag === "risky") {
      safetyNegatives.push("controversial imagery");
    }

    // Aggressive tone (visual de-escalation)
    if (flag === "aggressive") {
      safetyNegatives.push("threatening posture", "hostile imagery");
    }

    // Doxxing/PII patterns
    if (flag.includes("pii") || flag.includes("dox")) {
      safetyNegatives.push("personal information", "identifying details");
    }
  }

  return safetyNegatives;
}

/**
 * Get all negative prompt stages separately
 * Useful for debugging/analysis
 */
export function getNegativePromptStages(
  presetNegative?: string,
  safetyFlags?: string[]
): NegativePromptStage {
  return {
    global: [...GLOBAL_NEGATIVE_GUARDS],
    preset: presetNegative
      ? presetNegative.split(",").map((s) => s.trim()).filter(Boolean)
      : [],
    safety: safetyFlags ? buildSafetyNegative(safetyFlags) : [],
  };
}

/**
 * Check if a term is already covered by global guards
 */
export function isCoveredByGlobal(term: string): boolean {
  const normalizedTerm = term.toLowerCase().trim();
  return GLOBAL_NEGATIVE_GUARDS.some((guard) =>
    guard.toLowerCase().includes(normalizedTerm)
  );
}

/**
 * Deduplicate negative terms while keeping priority order
 * (global > preset > safety)
 */
export function deduplicateNegativeTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const term of terms) {
    const normalized = term.toLowerCase().trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(term.trim());
    }
  }

  return result;
}
