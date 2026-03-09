export type TemplateKey =
  | "Gorky_on_sol_courtroom"
  | "Gorky_on_sol_chart_autopsy"
  | "Gorky_on_sol_ghost"
  | "Gorky_on_sol_certificate"
  | "Gorky_on_sol_trade_screen";

export type Rarity = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "MYTHIC" | "COMBO";

export type RarityConfig = {
  weights: Record<Exclude<Rarity, "COMBO">, number>;
  templatePools: Record<Exclude<Rarity, "COMBO">, TemplateKey[]>;
  caps?: Partial<Record<Exclude<Rarity, "COMBO">, number>>;
};

// Backward compatibility aliases (legacy → current)
export const TEMPLATE_KEY_ALIASES: Record<string, TemplateKey> = {
  horny_courtroom: "Gorky_on_sol_courtroom",
  horny_chart_autopsy: "Gorky_on_sol_chart_autopsy",
  horny_ghost: "Gorky_on_sol_ghost",
  horny_certificate: "Gorky_on_sol_certificate",
  horny_trade_screen: "Gorky_on_sol_trade_screen",
};

export function resolveTemplateKey(key: string): TemplateKey {
  return TEMPLATE_KEY_ALIASES[key] || (key as TemplateKey);
}

export const DEFAULT_RARITY_CONFIG: RarityConfig = {
  weights: { COMMON: 70, UNCOMMON: 20, RARE: 7, EPIC: 2.5, MYTHIC: 0.5 },
  templatePools: {
    COMMON: ["Gorky_on_sol_trade_screen"],
    UNCOMMON: ["Gorky_on_sol_courtroom"],
    RARE: ["Gorky_on_sol_chart_autopsy"],
    EPIC: ["Gorky_on_sol_certificate"],
    MYTHIC: ["Gorky_on_sol_ghost"]
  },
  caps: { EPIC: 1, MYTHIC: 1 }
};
