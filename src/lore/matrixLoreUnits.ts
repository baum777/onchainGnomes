import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface MatrixLoreUnit {
  id: string;
  role_id: string;
  status: "candidate" | "approved" | "active" | string;
  content: string;
}

function getApprovedLorePath(): string {
  const fromCwd = join(process.cwd(), "memory", "lore", "lore_units.approved.jsonl");
  return fromCwd;
}

export function getActiveLoreForRole(roleId: string, limit: number = 2): string[] {
  const path = getApprovedLorePath();
  if (!existsSync(path)) return [];

  try {
    const rows = readFileSync(path, "utf-8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as MatrixLoreUnit)
      .filter((row) => row.status === "active" && row.role_id === roleId)
      .slice(0, Math.max(0, limit));

    return rows.map((row) => row.content);
  } catch {
    return [];
  }
}

