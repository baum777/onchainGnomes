/**
 * Load Gnomes — Load gnome profiles from data/gnomes/*.yaml
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import { DATA_DIR } from "../config/dataDir.js";
import { registerGnome } from "./registry.js";
import { isGnomeProfile, type GnomeProfile } from "./types.js";

const GNOMES_DATA_DIR = "gnomes";

/**
 * Load all gnome profiles from data/gnomes/*.yaml.
 * Registers them in the registry. Returns loaded profiles.
 */
export async function loadGnomes(): Promise<GnomeProfile[]> {
  const dir = join(DATA_DIR, GNOMES_DATA_DIR);

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      return [];
    }
    throw err;
  }

  const yamlFiles = entries.filter((e) => e.endsWith(".yaml") || e.endsWith(".yml"));
  const profiles: GnomeProfile[] = [];

  for (const file of yamlFiles) {
    const path = join(dir, file);
    const raw = await readFile(path, "utf-8");
    const parsed = yaml.load(raw) as unknown;

    if (isGnomeProfile(parsed)) {
      const profile = sanitizeProfile(parsed);
      registerGnome(profile);
      profiles.push(profile);
    }
  }

  return profiles;
}

function sanitizeProfile(p: GnomeProfile): GnomeProfile {
  return {
    ...p,
    id: String(p.id).toLowerCase().trim(),
    name: String(p.name).trim(),
    role: String(p.role).trim(),
    archetype: p.archetype,
  };
}
