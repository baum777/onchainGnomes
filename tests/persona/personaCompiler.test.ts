import { describe, it, expect } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import { isGnomeProfile, type GnomeProfile } from "../../src/gnomes/types.js";
import { buildSemanticRecordsFromProfiles } from "../../src/persona/compiler/buildSemanticRecords.js";

async function loadProfiles(): Promise<GnomeProfile[]> {
  const dir = join(process.cwd(), "data", "gnomes");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".yaml")).sort();
  const out: GnomeProfile[] = [];
  for (const file of files) {
    const parsed = yaml.load(await readFile(join(dir, file), "utf8"));
    if (!isGnomeProfile(parsed)) throw new Error(`invalid profile ${file}`);
    out.push(parsed);
  }
  return out;
}

describe("persona semantic compiler", () => {
  it("validates yaml schema extensions", async () => {
    const profiles = await loadProfiles();
    expect(profiles.every((p) => (p.semantic_facets ?? []).length > 0)).toBe(true);
    expect(profiles.every((p) => (p.style_anchors ?? []).length > 0)).toBe(true);
    expect(profiles.every((p) => (p.negative_anchors ?? []).length > 0)).toBe(true);
  });

  it("builds required records for every voice", async () => {
    const profiles = await loadProfiles();
    const records = buildSemanticRecordsFromProfiles(profiles, { version: "test-v1" });

    for (const p of profiles) {
      expect(records.some((r) => r.voiceId === p.id && r.docType === "voice_core")).toBe(true);
      expect(records.some((r) => r.voiceId === p.id && r.docType === "voice_style_anchor")).toBe(true);
      expect(records.some((r) => r.voiceId === p.id && r.docType === "voice_negative_boundary")).toBe(true);
      expect(records.some((r) => r.voiceId === p.id && r.docType === "voice_activation_rule")).toBe(true);
    }
  });

  it("is deterministic for same input", async () => {
    const profiles = await loadProfiles();
    const a = buildSemanticRecordsFromProfiles(profiles, { version: "test-v1" });
    const b = buildSemanticRecordsFromProfiles(profiles, { version: "test-v1" });
    expect(a).toEqual(b);
  });

  it("handles missing optional fields gracefully", () => {
    const records = buildSemanticRecordsFromProfiles([
      {
        id: "temp",
        name: "Temp",
        role: "test",
        archetype: "dry_observer",
        sigil: { char: "T", code: "U+0054", fallback: "[T]" },
      },
    ]);
    expect(records.some((r) => r.docType === "voice_core")).toBe(true);
  });
});
