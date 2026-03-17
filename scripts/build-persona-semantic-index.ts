import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import type { GnomeProfile } from "../src/gnomes/types.js";
import { isGnomeProfile } from "../src/gnomes/types.js";
import { buildSemanticRecordsFromProfiles } from "../src/persona/compiler/buildSemanticRecords.js";

async function loadProfiles(): Promise<GnomeProfile[]> {
  const dir = join(process.cwd(), "data", "gnomes");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml")).sort();
  const profiles: GnomeProfile[] = [];

  for (const file of files) {
    const parsed = yaml.load(await readFile(join(dir, file), "utf8"));
    if (!isGnomeProfile(parsed)) throw new Error(`Invalid gnome profile: ${file}`);
    profiles.push(parsed);
  }
  return profiles;
}

async function loadLoreByVoice(voiceIds: string[]): Promise<Record<string, string[]>> {
  const lorePath = join(process.cwd(), "docs", "lore", "LORE.md");
  let content = "";
  try {
    content = await readFile(lorePath, "utf8");
  } catch {
    return {};
  }

  const sentences = content.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 20);
  const byVoice: Record<string, string[]> = {};
  for (const voiceId of voiceIds) {
    byVoice[voiceId] = sentences.filter((line) => line.toLowerCase().includes(voiceId.slice(0, 6))).slice(0, 3);
  }
  return byVoice;
}

async function main(): Promise<void> {
  const version = process.env.PERSONA_SEMANTIC_VERSION ?? "v1";
  const splitByVoice = process.argv.includes("--split");
  const profiles = await loadProfiles();
  const loreByVoice = await loadLoreByVoice(profiles.map((p) => p.id));
  const records = buildSemanticRecordsFromProfiles(profiles, { version, loreByVoice });

  const outDir = join(process.cwd(), "artifacts");
  await mkdir(outDir, { recursive: true });
  const outFile = join(outDir, "persona-semantic-records.json");
  await writeFile(outFile, JSON.stringify(records, null, 2), "utf8");

  if (splitByVoice) {
    const grouped = records.reduce<Record<string, typeof records>>((acc, rec) => {
      acc[rec.voiceId] ??= [];
      acc[rec.voiceId].push(rec);
      return acc;
    }, {});

    for (const [voiceId, voiceRecords] of Object.entries(grouped)) {
      await writeFile(join(outDir, `persona-semantic-records.${voiceId}.json`), JSON.stringify(voiceRecords, null, 2), "utf8");
    }
  }

  console.log(`[persona] wrote ${records.length} records to ${outFile}`);
}

main().catch((err) => {
  console.error("[persona] build failed", err);
  process.exit(1);
});
