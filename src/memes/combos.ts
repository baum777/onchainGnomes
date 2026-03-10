import { pickOne, RNG } from "./dice.js";
import { TemplateKey } from "./rarity.js";

export type MemeCombo = {
  template: TemplateKey;
  textByZone: Record<string, string>;
};

export const COMBOS: MemeCombo[] = [
  {
    template: "twimsalot_courtroom",
    textByZone: {
      header: "RUG PULL TRIBUNAL",
      verdict: "VERDICT: FAKED DEATH, PUMPED, THEN RUGGED.",
      footer: "RUGGED FOR ETERNITY"
    }
  },
  {
    template: "twimsalot_chart_autopsy",
    textByZone: {
      title: "CHART AUTOPSY REPORT",
      cause: "Cause of death: NARRATIVE INFLATION.",
      footer: "AUTOPSY COMPLETE — R.I.P."
    }
  }
];

export function maybePickCombo(rng: RNG = Math.random): MemeCombo | null {
  // 15% chance to use a handcrafted combo
  if (rng() > 0.15) return null;
  return pickOne(COMBOS, rng);
}
