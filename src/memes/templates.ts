import { DEFAULT_RARITY_CONFIG, Rarity, RarityConfig, TemplateKey } from "./rarity.js";
import { pickOne, weightedPick, RNG } from "./dice.js";

export type TemplatePickContext = {
  userId: string;
  eligibleForHighRarity: boolean;
  rarityCountsLast24h?: Partial<Record<Rarity, number>>;
};

function enforceCaps(rarity: Exclude<Rarity, "COMBO">, ctx: TemplatePickContext, cfg: RarityConfig): boolean {
  const cap = cfg.caps?.[rarity];
  if (!cap) return true;
  const used = (ctx.rarityCountsLast24h as any)?.[rarity] ?? 0;
  return used < cap;
}

export function pickRarity(
  ctx: TemplatePickContext,
  cfg: RarityConfig = DEFAULT_RARITY_CONFIG,
  rng: RNG = Math.random
): Exclude<Rarity, "COMBO"> {
  const weights = { ...cfg.weights };

  if (!ctx.eligibleForHighRarity) {
    weights.EPIC = 0;
    weights.MYTHIC = 0;
  }

  (Object.keys(weights) as (Exclude<Rarity, "COMBO">)[]).forEach((r) => {
    if (!enforceCaps(r, ctx, cfg)) (weights as any)[r] = 0;
  });

  return weightedPick(weights as any, rng);
}

export function pickTemplate(
  ctx: TemplatePickContext,
  cfg: RarityConfig = DEFAULT_RARITY_CONFIG,
  rng: RNG = Math.random
): { rarity: Exclude<Rarity, "COMBO">; template: TemplateKey } {
  const rarity = pickRarity(ctx, cfg, rng);
  const pool = cfg.templatePools[rarity];
  const template = pickOne(pool, rng);
  return { rarity, template };
}
