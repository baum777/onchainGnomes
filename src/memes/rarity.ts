export type TemplateKey =
  | "GORKY_ON_SOL_courtroom"
  | "GORKY_ON_SOL_chart_autopsy"
  | "GORKY_ON_SOL_ghost"
  | "GORKY_ON_SOL_certificate"
  | "GORKY_ON_SOL_trade_screen";

export type Rarity = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "MYTHIC" | "COMBO";

export type RarityConfig = {
  weights: Record<Exclude<Rarity, "COMBO">, number>;
  templatePools: Record<Exclude<Rarity, "COMBO">, TemplateKey[]>;
  caps?: Partial<Record<Exclude<Rarity, "COMBO">, number>>;
};

// Backward compatibility aliases (legacy → current)
export const TEMPLATE_KEY_ALIASES: Record<string, TemplateKey> = {
  horny_courtroom: "GORKY_ON_SOL_courtroom",
  horny_chart_autopsy: "GORKY_ON_SOL_chart_autopsy",
  horny_ghost: "GORKY_ON_SOL_ghost",
  horny_certificate: "GORKY_ON_SOL_certificate",
  horny_trade_screen: "GORKY_ON_SOL_trade_screen",
};

export function resolveTemplateKey(key: string): TemplateKey {
  return TEMPLATE_KEY_ALIASES[key] || (key as TemplateKey);
}

export const DEFAULT_RARITY_CONFIG: RarityConfig = {
  weights: { COMMON: 70, UNCOMMON: 20, RARE: 7, EPIC: 2.5, MYTHIC: 0.5 },
  templatePools: {
    COMMON: ["GORKY_ON_SOL_trade_screen"],
    UNCOMMON: ["GORKY_ON_SOL_courtroom"],
    RARE: ["GORKY_ON_SOL_chart_autopsy"],
    EPIC: ["GORKY_ON_SOL_certificate"],
    MYTHIC: ["GORKY_ON_SOL_ghost"]
  },
  caps: { EPIC: 1, MYTHIC: 1 }
};
