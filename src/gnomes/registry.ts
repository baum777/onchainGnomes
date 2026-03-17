/**
 * Gnome Registry — In-memory character registry
 *
 * Holds loaded gnome profiles. Use loadGnomes() to populate from data/gnomes/*.yaml
 */

import type { GnomeProfile } from "./types.js";

/** In-memory registry of gnome profiles by id */
const registry = new Map<string, GnomeProfile>();

/**
 * Register a gnome profile. Overwrites if id exists.
 */
export function registerGnome(profile: GnomeProfile): void {
  registry.set(profile.id.toLowerCase(), profile);
}

/**
 * Get gnome by id. Returns undefined if not found.
 */
export function getGnome(id: string): GnomeProfile | undefined {
  return registry.get(id.toLowerCase());
}

/**
 * Get all registered gnomes.
 */
export function getAllGnomes(): GnomeProfile[] {
  return Array.from(registry.values());
}

/**
 * Get gnome ids for fallback chain (e.g. gorky -> grit -> moss).
 */
export function getFallbackChain(): string[] {
  const order = ["gorky", "grit", "moss"] as const;
  return order.filter((id) => registry.has(id));
}

/**
 * Clear registry (for tests).
 */
export function clearRegistry(): void {
  registry.clear();
}
