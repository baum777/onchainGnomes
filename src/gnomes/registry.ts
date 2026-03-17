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
 * Get fallback chain of defensive voices.
 */
export function getFallbackChain(): string[] {
  const order = ["stillhalter", "wurzelwaechter", "muenzhueter"] as const;
  const dynamic = order.filter((id) => registry.has(id));
  if (dynamic.length > 0) return dynamic;
  return Array.from(registry.keys()).sort();
}

/**
 * Clear registry (for tests).
 */
export function clearRegistry(): void {
  registry.clear();
}
