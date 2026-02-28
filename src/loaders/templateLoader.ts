import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";
import yaml from "js-yaml";

export type TextZone = {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  color?: string;
  align?: "left" | "center" | "right";
  maxLines?: number;
};

export type MemeTemplate = {
  template_key: string;
  base_style_prompt?: string;
  overlay_elements?: string[];
  text_zones: Record<string, string[]>;
  caption_style?: string;
};

export type LoadedTemplate = MemeTemplate & {
  sourcePath: string;
};

export function loadTemplate(path: string): LoadedTemplate {
  const content = readFileSync(path, "utf-8");
  const parsed = yaml.load(content) as MemeTemplate;

  if (!parsed.template_key) {
    throw new Error(`Template missing template_key: ${path}`);
  }
  if (!parsed.text_zones || Object.keys(parsed.text_zones).length === 0) {
    throw new Error(`Template missing text_zones: ${path}`);
  }

  return {
    ...parsed,
    sourcePath: path,
  };
}

export function loadAllTemplates(templatesDir: string): Map<string, LoadedTemplate> {
  const templates = new Map<string, LoadedTemplate>();

  try {
    const files = readdirSync(templatesDir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

    for (const file of files) {
      const path = join(templatesDir, file);
      try {
        const template = loadTemplate(path);
        templates.set(template.template_key, template);
      } catch (err) {
        console.warn(`Failed to load template ${file}:`, err);
      }
    }
  } catch {
    // Directory might not exist
  }

  return templates;
}

export function getTemplateTextZones(template: LoadedTemplate): Record<string, string[]> {
  return template.text_zones;
}
