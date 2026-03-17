import type { PersonaSemanticRecord } from "./types.js";

export type PersonaEpisode = {
  id: string;
  voiceId: string;
  userId?: string;
  threadId?: string;
  topicTags?: string[];
  interactionText: string;
  responseText: string;
  qualitySignals?: {
    accepted?: boolean;
    useful?: boolean;
    inCharacter?: boolean;
    driftRisk?: number;
  };
  createdAt: string;
};

export type ReflectionDecision = "retain" | "discard";
export type PromotionState = "none" | "promoted" | "rejected";

export interface PersonaReflection {
  episodeId: string;
  voiceId: string;
  qualityScore: number;
  inCharacterScore: number;
  utilityScore: number;
  driftRisk: number;
  retentionDecision: ReflectionDecision;
  promotionState: PromotionState;
  reasoning: string[];
  createdAt: string;
}

export interface EpisodicMemoryLayer {
  layer: "episodic";
  episodes: PersonaEpisode[];
}

export interface ReflectiveCurationLayer {
  layer: "reflective";
  reflections: PersonaReflection[];
}

export interface PersonaSemanticQuery {
  queryText: string;
  voiceId?: string;
  namespaces?: PersonaSemanticRecord["namespace"][];
  docTypes?: PersonaSemanticRecord["docType"][];
  limit?: number;
  includeInactive?: boolean;
}

export interface PersonaSemanticStore {
  upsert(records: PersonaSemanticRecord[]): Promise<void>;
  query(args: PersonaSemanticQuery): Promise<PersonaSemanticRecord[]>;
}
