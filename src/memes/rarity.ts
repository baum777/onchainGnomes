export type TemplateKey =
  | "gorkypf_courtroom"
  | "gorkypf_chart_autopsy"
  | "gorkypf_ghost"
  | "gorkypf_certificate"
  | "gorkypf_trade_screen";

export type Rarity = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "MYTHIC" | "COMBO";

export type RarityConfig = {
  weights: Record<Exclude<Rarity, "COMBO">, number>;
  templatePools: Record<Exclude<Rarity, "COMBO">, TemplateKey[]>;
  caps?: Partial<Record<Exclude<Rarity, "COMBO">, number>>;
};

// Backward compatibility aliases (legacy → current)
export const TEMPLATE_KEY_ALIASES: Record<string, TemplateKey> = {
  horny_courtroom: "gorkypf_courtroom",
  horny_chart_autopsy: "gorkypf_chart_autopsy",
  horny_ghost: "gorkypf_ghost",
  horny_certificate: "gorkypf_certificate",
  horny_trade_screen: "gorkypf_trade_screen",
};

export function resolveTemplateKey(key: string): TemplateKey {
  return TEMPLATE_KEY_ALIASES[key] || (key as TemplateKey);
}

export const DEFAULT_RARITY_CONFIG: RarityConfig = {
  weights: { COMMON: 70, UNCOMMON: 20, RARE: 7, EPIC: 2.5, MYTHIC: 0.5 },
  templatePools: {
    COMMON: ["gorkypf_trade_screen"],
    UNCOMMON: ["gorkypf_courtroom"],
    RARE: ["gorkypf_chart_autopsy"],
    EPIC: ["gorkypf_certificate"],
    MYTHIC: ["gorkypf_ghost"]
  },
  caps: { EPIC: 1, MYTHIC: 1 }
};
