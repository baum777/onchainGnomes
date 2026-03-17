/**
 * Joke Store — Persistent running jokes
 *
 * Phase-3: Stores recurring humor patterns for gnomes.
 */

export interface RunningJoke {
  id: string;
  category: string;
  content: string;
  gnome_id?: string;
  usage_count: number;
  last_used_at: string;
}

const store = new Map<string, RunningJoke>();
let idCounter = 0;

export function addJoke(joke: Omit<RunningJoke, "id" | "usage_count" | "last_used_at">): RunningJoke {
  const id = `joke_${++idCounter}`;
  const now = new Date().toISOString();
  const full: RunningJoke = {
    ...joke,
    id,
    usage_count: 0,
    last_used_at: now,
  };
  store.set(id, full);
  return full;
}

export function getJokesByCategory(category: string): RunningJoke[] {
  return Array.from(store.values()).filter((j) => j.category === category);
}

export function recordJokeUsage(id: string): void {
  const j = store.get(id);
  if (j) {
    j.usage_count++;
    j.last_used_at = new Date().toISOString();
  }
}

export function resetJokeStore(): void {
  store.clear();
  idCounter = 0;
}
