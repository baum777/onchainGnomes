export type TemplateKey =
  | "gorky_courtroom"
  | "gorky_chart_autopsy"
  | "gorky_ghost"
  | "gorky_certificate"
  | "gorky_trade_screen";

export type Rarity = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "MYTHIC" | "COMBO";

export type RarityConfig = {
  weights: Record<Exclude<Rarity, "COMBO">, number>;
  templatePools: Record<Exclude<Rarity, "COMBO">, TemplateKey[]>;
  caps?: Partial<Record<Exclude<Rarity, "COMBO">, number>>;
};

// Backward compatibility aliases (legacy → current)
export const TEMPLATE_KEY_ALIASES: Record<string, TemplateKey> = {
  horny_courtroom: "gorky_courtroom",
  horny_chart_autopsy: "gorky_chart_autopsy",
  horny_ghost: "gorky_ghost",
  horny_certificate: "gorky_certificate",
  horny_trade_screen: "gorky_trade_screen",
};

export function resolveTemplateKey(key: string): TemplateKey {
  return TEMPLATE_KEY_ALIASES[key] || (key as TemplateKey);
}

export const DEFAULT_RARITY_CONFIG: RarityConfig = {
  weights: { COMMON: 70, UNCOMMON: 20, RARE: 7, EPIC: 2.5, MYTHIC: 0.5 },
  templatePools: {
    COMMON: ["gorky_trade_screen"],
    UNCOMMON: ["gorky_courtroom"],
    RARE: ["gorky_chart_autopsy"],
    EPIC: ["gorky_certificate"],
    MYTHIC: ["gorky_ghost"]
  },
  caps: { EPIC: 1, MYTHIC: 1 }
};
