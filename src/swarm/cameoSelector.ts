/**
 * Cameo Selector — Choose cameo gnomes for swarm replies
 *
 * Phase-3: Selects secondary gnomes when swarm mode is active.
 */

export interface CameoContext {
  primaryGnomeId: string;
  conversationEnergy: number;
  absurdityScore: number;
  availableGnomes: string[];
}

/** Select up to maxCameos secondary gnomes. */
export function selectCameos(
  ctx: CameoContext,
  opts?: { maxCameos?: number; energyThreshold?: number },
): string[] {
  const max = opts?.maxCameos ?? 2;
  const threshold = opts?.energyThreshold ?? 0.7;
  if (ctx.conversationEnergy < threshold || ctx.absurdityScore < 0.5)
    return [];
  const others = ctx.availableGnomes.filter((g) => g !== ctx.primaryGnomeId);
  return others.slice(0, max);
}
