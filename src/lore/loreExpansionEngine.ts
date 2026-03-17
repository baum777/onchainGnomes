/**
 * Lore Expansion Engine — Bounded autonomous lore expansion
 *
 * Phase-5: Produces lore candidates for review; never auto-activates.
 */

import { generateLoreCandidates, type LoreCandidate } from "./loreCandidateGenerator.js";

export interface ExpansionResult {
  candidates: LoreCandidate[];
  rejected: string[];
}

/** Collect and propose lore candidates (bounded). */
export async function expandLore(
  motifs: string[],
  opts?: { enabled?: boolean; maxCandidates?: number },
): Promise<ExpansionResult> {
  const enabled = opts?.enabled ?? false;
  if (!enabled) return { candidates: [], rejected: [] };
  const candidates = generateLoreCandidates(motifs, { enabled });
  return {
    candidates: candidates.slice(0, opts?.maxCandidates ?? 5),
    rejected: [],
  };
}
