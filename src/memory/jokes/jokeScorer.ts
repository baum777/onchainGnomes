/**
 * Joke Scorer — Rank jokes by relevance
 *
 * Phase-3: Scores jokes for insertion into prompts.
 */

import type { RunningJoke } from "./jokeStore.js";

export function scoreJoke(
  joke: RunningJoke,
  context: { topic?: string; gnome_id?: string; recency_weight?: number },
): number {
  let score = 0.5;
  if (context.gnome_id && joke.gnome_id === context.gnome_id) score += 0.2;
  score += Math.min(joke.usage_count * 0.02, 0.2); // familiarity
  return Math.min(score, 1);
}
