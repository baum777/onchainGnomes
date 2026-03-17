import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PersonaSemanticStore, PersonaSemanticQuery } from "../memoryTypes.js";
import type { PersonaSemanticRecord } from "../types.js";
import { InMemoryPersonaSemanticStore } from "./inMemoryPersonaSemanticStore.js";

export class FilePersonaSemanticStore implements PersonaSemanticStore {
  constructor(private readonly filePath: string) {}

  private async loadRecords(): Promise<PersonaSemanticRecord[]> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as PersonaSemanticRecord[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async saveRecords(records: PersonaSemanticRecord[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(records, null, 2), "utf8");
  }

  async upsert(records: PersonaSemanticRecord[]): Promise<void> {
    const existing = await this.loadRecords();
    const map = new Map(existing.map((r) => [r.id, r]));
    for (const r of records) map.set(r.id, r);
    await this.saveRecords(Array.from(map.values()));
  }

  async query(args: PersonaSemanticQuery): Promise<PersonaSemanticRecord[]> {
    const mem = new InMemoryPersonaSemanticStore();
    await mem.upsert(await this.loadRecords());
    return mem.query(args);
  }
}
