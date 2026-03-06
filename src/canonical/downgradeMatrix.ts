import type { CanonicalMode } from "./types.js";

const DOWNGRADE_MAP: Record<string, CanonicalMode> = {
  hard_caution: "skeptical_breakdown",
  skeptical_breakdown: "neutral_clarification",
  analyst_meme_lite: "dry_one_liner",
  dry_one_liner: "soft_deflection",
  neutral_clarification: "soft_deflection",
  soft_deflection: "ignore",
};

export function downgradeMode(current: CanonicalMode): CanonicalMode {
  if (current === "ignore") return "ignore";
  return DOWNGRADE_MAP[current] ?? "ignore";
}
