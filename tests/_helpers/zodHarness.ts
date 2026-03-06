import { ZodSchema } from "zod";

export function parseWithZod<T>(schema: ZodSchema<T>, data: unknown): T {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const msg =
      "Zod validation failed:\n" +
      parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(msg);
  }
  return parsed.data;
}
