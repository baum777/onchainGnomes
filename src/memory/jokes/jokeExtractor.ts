/**
 * Joke Extractor — Detect recurring humor patterns
 *
 * Phase-3: Identifies phrases suitable for running jokes.
 */

export interface JokeCandidate {
  phrase: string;
  category: string;
  confidence: number;
}

/** Extract joke candidates from reply text (stub). */
export function extractJokeCandidates(
  _replyText: string,
  _gnomeId: string,
  _opts?: { enabled?: boolean },
): JokeCandidate[] {
  return [];
}
