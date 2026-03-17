/**
 * World State — Shared civilization state
 *
 * Phase-5: Mood, events, faction tensions, myths.
 */

export type CivilizationMood =
  | "mournful"
  | "feral"
  | "mocking"
  | "ritual"
  | "chaotic"
  | "builder_skeptic";

export interface WorldState {
  epoch: string;
  civilizationMood: CivilizationMood;
  activeEventIds: string[];
  activeFactionTensions: string[];
  activeMyths: string[];
  globalHeatLevel: number;
  updatedAt: string;
}

export const DEFAULT_WORLD_STATE: WorldState = {
  epoch: "1",
  civilizationMood: "mocking",
  activeEventIds: [],
  activeFactionTensions: [],
  activeMyths: [],
  globalHeatLevel: 0.5,
  updatedAt: new Date().toISOString(),
};
