import type { GnomeProfile } from "../gnomes/types.js";

export type PersonaMemoryLayer = "core" | "semantic" | "episodic" | "reflective";

export interface CorePersonaLayer {
  layer: "core";
  profile: GnomeProfile;
  source: "yaml";
}

export type PersonaSemanticDocType =
  | "voice_core"
  | "voice_style_anchor"
  | "voice_activation_rule"
  | "voice_negative_boundary"
  | "voice_example"
  | "voice_relation"
  | "lore_chunk";

export type PersonaSemanticRecord = {
  id: string;
  voiceId: string;
  namespace:
    | "voices-core"
    | "voices-style"
    | "voices-examples"
    | "voices-relations"
    | "lore-active"
    | "memory-episodic";
  docType: PersonaSemanticDocType;
  text: string;
  metadata: {
    role: string;
    archetype: string;
    loreTags?: string[];
    intents?: string[];
    energy?: "low" | "mid" | "high";
    safetyCritical?: boolean;
    relationTarget?: string;
    relationType?: "complements" | "suppresses" | "escalates_with" | "stabilizes_with";
    exampleQuality?: "gold" | "silver" | "bronze";
    sourceType?: "yaml" | "lore" | "example" | "reflection";
    active?: boolean;
    version: string;
    retrievalPriority?: number;
    derivedFrom?: string;
  };
};

export interface SemanticPersonaLayer {
  layer: "semantic";
  records: PersonaSemanticRecord[];
}
