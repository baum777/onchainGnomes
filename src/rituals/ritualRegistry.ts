/**
 * Ritual Registry — Recurring civilization behaviors
 *
 * Phase-5: Stylistic overlays (chart funeral, liquidity lament, etc.).
 */

export interface Ritual {
  id: string;
  name: string;
  motifFragment?: string;
}

const RITUALS: Ritual[] = [
  { id: "rit_chart_funeral", name: "chart_funeral_blessing", motifFragment: "ashes to ashes, chart to chart" },
  { id: "rit_liquidity", name: "liquidity_lament", motifFragment: "liquidity thirst" },
];

export function getRituals(): Ritual[] {
  return [...RITUALS];
}
