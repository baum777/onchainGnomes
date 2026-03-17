import type { GnomeProfile } from "../../gnomes/types.js";
import type { PersonaSemanticStore } from "../memoryTypes.js";
import type { PersonaSemanticRecord } from "../types.js";

export interface VoiceSemanticScore {
  voiceId: string;
  ruleBasedScore: number;
  semanticFitScore: number;
  continuityScore: number;
  finalSelectionScore: number;
  anchors: string[];
  boundaries: string[];
  explain: string[];
}

function lexicalMatchScore(text: string, query: string): number {
  const tokens = query.toLowerCase().split(/\W+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  const low = text.toLowerCase();
  return tokens.filter((t) => low.includes(t)).length / tokens.length;
}

export async function scoreSemanticVoiceFit(args: {
  store: PersonaSemanticStore;
  voices: GnomeProfile[];
  queryText: string;
  ruleBasedScores?: Record<string, number>;
  continuityVoiceId?: string;
}): Promise<VoiceSemanticScore[]> {
  const all = await args.store.query({ queryText: args.queryText, limit: 200, includeInactive: false });

  return args.voices
    .map((voice) => {
      const voiceRecords = all.filter((r) => r.voiceId === voice.id);
      const semanticFit = voiceRecords.length === 0
        ? 0
        : Math.min(
            1,
            voiceRecords.reduce((acc, r) => acc + lexicalMatchScore(r.text, args.queryText), 0) / voiceRecords.length,
          );
      const ruleBasedScore = args.ruleBasedScores?.[voice.id] ?? 0;
      const continuityScore = args.continuityVoiceId === voice.id ? 0.15 : 0;
      const finalSelectionScore = ruleBasedScore * 0.65 + semanticFit * 0.3 + continuityScore;
      const anchors = voiceRecords.filter((r) => r.docType === "voice_style_anchor").slice(0, 3).map((r) => r.text);
      const boundaries = voiceRecords.filter((r) => r.docType === "voice_negative_boundary").slice(0, 3).map((r) => r.text);

      return {
        voiceId: voice.id,
        ruleBasedScore,
        semanticFitScore: semanticFit,
        continuityScore,
        finalSelectionScore,
        anchors,
        boundaries,
        explain: [
          `rule=${ruleBasedScore.toFixed(2)}`,
          `semantic=${semanticFit.toFixed(2)}`,
          `continuity=${continuityScore.toFixed(2)}`,
        ],
      };
    })
    .sort((a, b) => b.finalSelectionScore - a.finalSelectionScore || a.voiceId.localeCompare(b.voiceId));
}

export async function retrievePersonaContext(store: PersonaSemanticStore, voiceId: string, queryText: string): Promise<PersonaSemanticRecord[]> {
  return store.query({
    queryText,
    voiceId,
    namespaces: ["voices-core", "voices-style"],
    docTypes: ["voice_core", "voice_style_anchor", "voice_negative_boundary", "voice_activation_rule"],
    limit: 8,
  });
}

export async function retrieveVoiceExemplars(store: PersonaSemanticStore, voiceId: string, queryText: string): Promise<PersonaSemanticRecord[]> {
  return store.query({ queryText, voiceId, namespaces: ["voices-examples"], docTypes: ["voice_example"], limit: 4 });
}

export async function retrieveVoiceRelations(store: PersonaSemanticStore, voiceId: string, queryText: string): Promise<PersonaSemanticRecord[]> {
  return store.query({ queryText, voiceId, namespaces: ["voices-relations"], docTypes: ["voice_relation"], limit: 6 });
}

export async function retrieveLoreSupport(store: PersonaSemanticStore, voiceId: string, queryText: string): Promise<PersonaSemanticRecord[]> {
  return store.query({ queryText, voiceId, namespaces: ["lore-active"], docTypes: ["lore_chunk"], limit: 4 });
}
