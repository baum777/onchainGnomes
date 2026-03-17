import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { GnomeProfile } from "../../gnomes/types.js";
import type { SelectorFeatures } from "../../routing/selectorFeatures.js";
import type { PersonaSemanticRecord } from "../types.js";
import { InMemoryPersonaSemanticStore } from "../stores/inMemoryPersonaSemanticStore.js";
import { scoreSemanticVoiceFit } from "./helpers.js";

let cachedStore: InMemoryPersonaSemanticStore | null = null;
let loaded = false;

async function getStore(): Promise<InMemoryPersonaSemanticStore> {
  if (cachedStore && loaded) return cachedStore;
  const store = new InMemoryPersonaSemanticStore();
  const file = join(process.cwd(), "artifacts", "persona-semantic-records.json");

  try {
    const parsed = JSON.parse(await readFile(file, "utf8")) as PersonaSemanticRecord[];
    if (Array.isArray(parsed)) await store.upsert(parsed);
  } catch {
    // optional artifact
  }

  cachedStore = store;
  loaded = true;
  return store;
}

export async function buildSemanticSelectionInputs(args: {
  voices: GnomeProfile[];
  features: SelectorFeatures;
  ruleBasedScores: Record<string, number>;
  continuityVoiceId?: string;
}): Promise<{
  semanticFitByGnome: Record<string, number>;
  continuityBonusByGnome: Record<string, number>;
  semanticExplainByGnome: Record<string, { anchors: string[]; boundaries: string[]; reasons: string[] }>;
}> {
  const store = await getStore();
  const scored = await scoreSemanticVoiceFit({
    store,
    voices: args.voices,
    queryText: `${args.features.intent} ${args.features.topicTags.join(" ")}`,
    ruleBasedScores: args.ruleBasedScores,
    continuityVoiceId: args.continuityVoiceId,
  });

  const semanticFitByGnome: Record<string, number> = {};
  const continuityBonusByGnome: Record<string, number> = {};
  const semanticExplainByGnome: Record<string, { anchors: string[]; boundaries: string[]; reasons: string[] }> = {};

  for (const s of scored) {
    semanticFitByGnome[s.voiceId] = s.semanticFitScore;
    continuityBonusByGnome[s.voiceId] = s.continuityScore;
    semanticExplainByGnome[s.voiceId] = { anchors: s.anchors, boundaries: s.boundaries, reasons: s.explain };
  }

  return { semanticFitByGnome, continuityBonusByGnome, semanticExplainByGnome };
}
