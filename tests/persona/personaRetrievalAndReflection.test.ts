import { describe, it, expect } from "vitest";
import type { GnomeProfile } from "../../src/gnomes/types.js";
import { InMemoryPersonaSemanticStore } from "../../src/persona/stores/inMemoryPersonaSemanticStore.js";
import { buildSemanticRecordsFromProfiles } from "../../src/persona/compiler/buildSemanticRecords.js";
import { retrieveVoiceRelations, scoreSemanticVoiceFit } from "../../src/persona/retrieval/helpers.js";
import { reflectEpisode, promoteEpisodeToSemanticRecord } from "../../src/persona/reflection/curation.js";
import { selectGnome } from "../../src/routing/gnomeSelector.js";
import type { SelectorFeatures } from "../../src/routing/selectorFeatures.js";

const stillhalter: GnomeProfile = {
  id: "stillhalter",
  name: "Stillhalter",
  role: "volatility_brake",
  archetype: "dry_observer",
  sigil: { char: "🪨", code: "U+1FAA8", fallback: "[S]" },
  semantic_facets: ["deescalation"],
  style_anchors: ["de-escalate first"],
  negative_anchors: ["no meme escalation"],
  safety_boundaries: ["Never imply buy/sell advice."],
  relation_hints: { suppresses: ["nebelspieler"] },
};

const nebel: GnomeProfile = {
  id: "nebelspieler",
  name: "Nebelspieler",
  role: "meme_translator",
  archetype: "playful_teaser",
  sigil: { char: "🌫", code: "U+1F32B", fallback: "[N]" },
  semantic_facets: ["meme_translation"],
  style_anchors: ["short playful side-eye"],
  negative_anchors: ["do not override caution voices"],
};

const features: SelectorFeatures = {
  intent: "hard_caution",
  aggressionScore: 0.2,
  absurdityScore: 0.5,
  sincerityScore: 0.8,
  topicTags: ["risk"],
  marketEnergy: "LOW",
  userFamiliarity: 0,
  relevanceScore: 0.9,
  confidenceScore: 0.9,
};

describe("persona retrieval + reflection", () => {
  it("translates relation hints into relation docs", async () => {
    const store = new InMemoryPersonaSemanticStore();
    await store.upsert(buildSemanticRecordsFromProfiles([stillhalter, nebel]));
    const relations = await retrieveVoiceRelations(store, "stillhalter", "suppress");
    expect(relations.some((r) => r.metadata.relationTarget === "nebelspieler")).toBe(true);
  });

  it("semantic scoring augments but does not override hard caution constraints", () => {
    const result = selectGnome(features, "hard_caution", {
      enabled: true,
      semanticFitByGnome: { nebelspieler: 1, stillhalter: 0 },
      userAffinityByGnome: { nebelspieler: 1 },
    });
    expect(result.selectedGnomeId).toBe("stillhalter");
  });

  it("rejects low-quality/high-drift episodes and promotes good episodes as derived", async () => {
    const badEpisode = {
      id: "ep-bad",
      voiceId: "stillhalter",
      interactionText: "market panic",
      responseText: "BUY NOW moon guaranteed",
      qualitySignals: { useful: false, accepted: false, driftRisk: 0.95 },
      createdAt: new Date().toISOString(),
    };
    const goodEpisode = {
      id: "ep-good",
      voiceId: "stillhalter",
      interactionText: "high volatility",
      responseText: "deescalation mode: de-escalate first, preserve optionality",
      qualitySignals: { useful: true, accepted: true, driftRisk: 0.1 },
      createdAt: new Date().toISOString(),
    };

    const badReflection = reflectEpisode(badEpisode, stillhalter);
    const goodReflection = reflectEpisode(goodEpisode, stillhalter);

    expect(badReflection.promotionState).toBe("rejected");
    expect(goodReflection.promotionState).toBe("promoted");

    const promoted = promoteEpisodeToSemanticRecord(goodEpisode, goodReflection, stillhalter, "v-test");
    expect(promoted?.metadata.sourceType).toBe("reflection");
    expect(promoted?.metadata.derivedFrom).toBe("ep-good");
  });

  it("computes semantic fit scores", async () => {
    const store = new InMemoryPersonaSemanticStore();
    await store.upsert(buildSemanticRecordsFromProfiles([stillhalter, nebel]));
    const scored = await scoreSemanticVoiceFit({ store, voices: [stillhalter, nebel], queryText: "de-escalation volatility" });
    expect(scored[0]?.voiceId).toBe("stillhalter");
  });
});
