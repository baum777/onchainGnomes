import { join } from "node:path";

const isProduction = process.env.NODE_ENV === "production";

export const DATA_DIR = process.env.DATA_DIR
  ?? (isProduction ? "/data" : join(process.cwd(), "data"));
