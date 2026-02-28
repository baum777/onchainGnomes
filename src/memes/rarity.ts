export type TemplateKey =
  | "horny_courtroom"
  | "horny_chart_autopsy"
  | "horny_ghost"
  | "horny_certificate"
  | "horny_trade_screen";

export type Rarity = "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "MYTHIC" | "COMBO";

export type RarityConfig = {
  weights: Record<Exclude<Rarity, "COMBO">, number>;
  templatePools: Record<Exclude<Rarity, "COMBO">, TemplateKey[]>;
  caps?: Partial<Record<Exclude<Rarity, "COMBO">, number>>;
};

export const DEFAULT_RARITY_CONFIG: RarityConfig = {
  weights: { COMMON: 70, UNCOMMON: 20, RARE: 7, EPIC: 2.5, MYTHIC: 0.5 },
  templatePools: {
    COMMON: ["horny_trade_screen"],
    UNCOMMON: ["horny_courtroom"],
    RARE: ["horny_chart_autopsy"],
    EPIC: ["horny_certificate"],
    MYTHIC: ["horny_ghost"]
  },
  caps: { EPIC: 1, MYTHIC: 1 }
};
