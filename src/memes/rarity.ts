export type TemplateKey =
  | "twimsalot_courtroom"
  | "twimsalot_chart_autopsy"
  | "twimsalot_ghost"
  | "twimsalot_certificate"
  | "twimsalot_trade_screen";

export type Rarity = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "MYTHIC" | "COMBO";

export type RarityConfig = {
  weights: Record<Exclude<Rarity, "COMBO">, number>;
  templatePools: Record<Exclude<Rarity, "COMBO">, TemplateKey[]>;
  caps?: Partial<Record<Exclude<Rarity, "COMBO">, number>>;
};

// Backward compatibility aliases (legacy → current)
export const TEMPLATE_KEY_ALIASES: Record<string, TemplateKey> = {
  horny_courtroom: "twimsalot_courtroom",
  horny_chart_autopsy: "twimsalot_chart_autopsy",
  horny_ghost: "twimsalot_ghost",
  horny_certificate: "twimsalot_certificate",
  horny_trade_screen: "twimsalot_trade_screen",
};

export function resolveTemplateKey(key: string): TemplateKey {
  return TEMPLATE_KEY_ALIASES[key] || (key as TemplateKey);
}

export const DEFAULT_RARITY_CONFIG: RarityConfig = {
  weights: { COMMON: 70, UNCOMMON: 20, RARE: 7, EPIC: 2.5, MYTHIC: 0.5 },
  templatePools: {
    COMMON: ["twimsalot_trade_screen"],
    UNCOMMON: ["twimsalot_courtroom"],
    RARE: ["twimsalot_chart_autopsy"],
    EPIC: ["twimsalot_certificate"],
    MYTHIC: ["twimsalot_ghost"]
  },
  caps: { EPIC: 1, MYTHIC: 1 }
};
