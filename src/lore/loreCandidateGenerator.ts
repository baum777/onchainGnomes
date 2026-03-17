/**
 * Lore Candidate Generator — Propose new lore from motifs
 *
 * Phase-5: Generates candidate lore fragments (bounded, reviewable).
 */

export interface LoreCandidate {
  id: string;
  content: string;
  source_motif: string;
  status: "candidate" | "reviewed" | "approved" | "active" | "archived" | "rejected";
  created_at: string;
}

/** Stub: return empty when disabled. */
export function generateLoreCandidates(
  _motifs: string[],
  opts?: { enabled?: boolean },
): LoreCandidate[] {
  if (!opts?.enabled || !_motifs.length) return [];
  return [];
}
