/**
 * Character Interaction Graph — Gnome-to-gnome relationships
 *
 * Phase-4: Influences cameo likelihood (rivalry, mentor, alliance, etc.).
 */

export type RelationshipType =
  | "rivalry"
  | "mentor"
  | "teasing"
  | "alliance"
  | "mockery"
  | "respect";

export interface CharacterRelationship {
  gnomeA: string;
  gnomeB: string;
  type: RelationshipType;
  strength: number; // 0..1
}

const DEFAULT_RELATIONSHIPS: CharacterRelationship[] = [
  { gnomeA: "spark", gnomeB: "gorky", type: "teasing", strength: 0.8 },
  { gnomeA: "moss", gnomeB: "gorky", type: "respect", strength: 0.7 },
  { gnomeA: "moss", gnomeB: "spark", type: "mockery", strength: 0.6 },
];

const graph = new Map<string, Map<string, CharacterRelationship>>();

function key(a: string, b: string): string {
  return [a, b].sort().join(":");
}

function init(): void {
  if (graph.size > 0) return;
  for (const r of DEFAULT_RELATIONSHIPS) {
    const k = key(r.gnomeA, r.gnomeB);
    graph.set(k, new Map());
    graph.get(k)!.set("rel", r);
  }
}

/** Get relationship between two gnomes. */
export function getRelationship(gnomeA: string, gnomeB: string): CharacterRelationship | null {
  init();
  const k = key(gnomeA, gnomeB);
  return (graph.get(k)?.get("rel") as CharacterRelationship) ?? null;
}

/** Check if gnomeB is likely to cameo after gnomeA (e.g. SPARK often interrupts GORKY). */
export function getCameoLikelihood(primary: string, candidate: string): number {
  const rel = getRelationship(primary, candidate);
  if (!rel) return 0.3;
  if (["teasing", "mockery", "alliance"].includes(rel.type)) return 0.4 + rel.strength * 0.3;
  return 0.3;
}
