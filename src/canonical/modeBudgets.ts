import type { CanonicalMode, ModeBudget } from "./types.js";

export const MODE_BUDGETS: Record<Exclude<CanonicalMode, "ignore">, ModeBudget> = {
  dry_one_liner: { soft_target: 90, hard_max: 160, confidence_floor: 0.45 },
  analyst_meme_lite: { soft_target: 150, hard_max: 240, confidence_floor: 0.55 },
  skeptical_breakdown: { soft_target: 220, hard_max: 280, confidence_floor: 0.65 },
  hard_caution: { soft_target: 220, hard_max: 280, confidence_floor: 0.75 },
  neutral_clarification: { soft_target: 180, hard_max: 260, confidence_floor: 0.50 },
  soft_deflection: { soft_target: 80, hard_max: 160, confidence_floor: 0.25 },
};

export function getBudget(mode: CanonicalMode): ModeBudget | null {
  if (mode === "ignore") return null;
  return MODE_BUDGETS[mode];
}

export function getConfidenceFloor(mode: CanonicalMode): number {
  if (mode === "ignore") return 1;
  return MODE_BUDGETS[mode].confidence_floor;
}

export function getHardMax(mode: CanonicalMode): number {
  if (mode === "ignore") return 0;
  return MODE_BUDGETS[mode].hard_max;
}
