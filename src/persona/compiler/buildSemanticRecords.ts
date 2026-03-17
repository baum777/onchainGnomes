import { createHash } from "node:crypto";
import type { GnomeProfile } from "../../gnomes/types.js";
import type { PersonaSemanticRecord } from "../types.js";

export interface BuildSemanticRecordsOptions {
  version?: string;
  loreByVoice?: Record<string, string[]>;
}

const RELATION_LABELS: Record<string, string> = {
  complements: "complements",
  suppresses: "suppresses",
  escalates_with: "escalates with",
  stabilizes_with: "stabilizes with",
};

function makeRecordId(voiceId: string, docType: string, text: string, version: string): string {
  const digest = createHash("sha256").update(`${voiceId}|${docType}|${version}|${text}`).digest("hex").slice(0, 16);
  return `${voiceId}:${docType}:${digest}`;
}

function compact(parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

export function buildSemanticRecordsFromProfiles(
  profiles: GnomeProfile[],
  opts?: BuildSemanticRecordsOptions,
): PersonaSemanticRecord[] {
  const version = opts?.version ?? "v1";
  const loreByVoice = opts?.loreByVoice ?? {};
  const records: PersonaSemanticRecord[] = [];

  for (const profile of profiles) {
    const intents = profile.routing_hints?.preferred_intents ?? [];
    const energy = profile.routing_hints?.preferred_energy?.[0] as "low" | "mid" | "high" | undefined;
    const loreTags = profile.memory_rules?.default_lore_tags ?? [];

    const coreText = compact([
      `${profile.name} is a ${profile.role} gnome with archetype ${profile.archetype}.`,
      profile.voice_traits?.tone ? `Tone: ${profile.voice_traits.tone}.` : undefined,
      profile.semantic_facets?.length ? `Semantic facets: ${profile.semantic_facets.join(", ")}.` : undefined,
      profile.style_anchors?.length ? `Style anchors: ${profile.style_anchors.join(" | ")}.` : undefined,
    ]);

    const coreRecord: PersonaSemanticRecord = {
      id: makeRecordId(profile.id, "voice_core", coreText, version),
      voiceId: profile.id,
      namespace: "voices-core",
      docType: "voice_core",
      text: coreText,
      metadata: {
        role: profile.role,
        archetype: profile.archetype,
        loreTags,
        intents,
        energy,
        safetyCritical: true,
        sourceType: "yaml",
        active: true,
        version,
        retrievalPriority: profile.retrieval_priority,
        derivedFrom: `data/gnomes/${profile.id}.yaml`,
      },
    };
    records.push(coreRecord);

    for (const anchor of profile.style_anchors ?? []) {
      records.push({
        id: makeRecordId(profile.id, "voice_style_anchor", anchor, version),
        voiceId: profile.id,
        namespace: "voices-style",
        docType: "voice_style_anchor",
        text: `${profile.name} style anchor: ${anchor}`,
        metadata: {
          role: profile.role,
          archetype: profile.archetype,
          loreTags,
          intents,
          energy,
          sourceType: "yaml",
          active: true,
          version,
          retrievalPriority: profile.retrieval_priority,
        },
      });
    }

    const activation = compact([
      `${profile.name} activates for intents: ${intents.join(", ") || "general discourse"}.`,
      profile.semantic_facets?.length ? `Prioritize when semantic facets match: ${profile.semantic_facets.join(", ")}.` : undefined,
      profile.routing_hints?.aggression_range
        ? `Best fit when aggression is within ${profile.routing_hints.aggression_range[0]}-${profile.routing_hints.aggression_range[1]}.`
        : undefined,
    ]);
    records.push({
      id: makeRecordId(profile.id, "voice_activation_rule", activation, version),
      voiceId: profile.id,
      namespace: "voices-core",
      docType: "voice_activation_rule",
      text: activation,
      metadata: {
        role: profile.role,
        archetype: profile.archetype,
        loreTags,
        intents,
        energy,
        sourceType: "yaml",
        active: true,
        version,
      },
    });

    for (const boundary of [...(profile.negative_anchors ?? []), ...(profile.safety_boundaries ?? [])]) {
      records.push({
        id: makeRecordId(profile.id, "voice_negative_boundary", boundary, version),
        voiceId: profile.id,
        namespace: "voices-style",
        docType: "voice_negative_boundary",
        text: `${profile.name} boundary: ${boundary}`,
        metadata: {
          role: profile.role,
          archetype: profile.archetype,
          loreTags,
          intents,
          energy,
          safetyCritical: true,
          sourceType: "yaml",
          active: true,
          version,
        },
      });
    }

    for (const example of profile.canonical_examples ?? []) {
      records.push({
        id: makeRecordId(profile.id, "voice_example", example, version),
        voiceId: profile.id,
        namespace: "voices-examples",
        docType: "voice_example",
        text: example,
        metadata: {
          role: profile.role,
          archetype: profile.archetype,
          loreTags,
          intents,
          energy,
          sourceType: "example",
          exampleQuality: "gold",
          active: true,
          version,
        },
      });
    }

    const relationHints = profile.relation_hints ?? {};
    for (const key of Object.keys(RELATION_LABELS) as Array<keyof typeof relationHints>) {
      for (const target of relationHints[key] ?? []) {
        const text = `${profile.name} ${RELATION_LABELS[key]} ${target} in multi-voice mode.`;
        records.push({
          id: makeRecordId(profile.id, "voice_relation", `${key}:${target}`, version),
          voiceId: profile.id,
          namespace: "voices-relations",
          docType: "voice_relation",
          text,
          metadata: {
            role: profile.role,
            archetype: profile.archetype,
            loreTags,
            intents,
            energy,
            relationTarget: target,
            relationType: key as "complements" | "suppresses" | "escalates_with" | "stabilizes_with",
            sourceType: "yaml",
            active: true,
            version,
          },
        });
      }
    }

    for (const loreChunk of loreByVoice[profile.id] ?? []) {
      records.push({
        id: makeRecordId(profile.id, "lore_chunk", loreChunk, version),
        voiceId: profile.id,
        namespace: "lore-active",
        docType: "lore_chunk",
        text: loreChunk,
        metadata: {
          role: profile.role,
          archetype: profile.archetype,
          loreTags,
          sourceType: "lore",
          active: true,
          version,
        },
      });
    }
  }

  return records.sort((a, b) => a.id.localeCompare(b.id));
}
