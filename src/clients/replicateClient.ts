/**
 * Replicate Image Client
 *
 * Wrapper for Replicate API to generate images from prompts.
 * Supports configurable models via REPLICATE_IMAGE_MODEL env var.
 * Includes timeouts for generation and download.
 */

import Replicate from "replicate";
import { withTimeout } from "../utils/withTimeout.js";

export type ReplicateGenerateInput = {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  num_outputs?: number;
  seed?: number;
  guidance?: number;
};

export type ReplicateImageClientConfig = {
  apiKey: string;
  // e.g. "xai/grok-imagine" or any replicate model slug
  model: string;
};

// Default timeouts (in ms)
const DEFAULT_RUN_TIMEOUT_MS = 45000; // 45s for generation
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 20000; // 20s for download

export class ReplicateImageClient {
  private replicate: Replicate;
  private model: string;
  private runTimeoutMs: number;
  private downloadTimeoutMs: number;

  constructor(cfg: ReplicateImageClientConfig) {
    this.replicate = new Replicate({ auth: cfg.apiKey });
    this.model = cfg.model;
    this.runTimeoutMs = Number(process.env.REPLICATE_RUN_TIMEOUT_MS ?? DEFAULT_RUN_TIMEOUT_MS);
    this.downloadTimeoutMs = Number(process.env.REPLICATE_DOWNLOAD_TIMEOUT_MS ?? DEFAULT_DOWNLOAD_TIMEOUT_MS);
  }

  async generateImageBuffer(input: ReplicateGenerateInput): Promise<Buffer> {
    // Step 1: Generate with timeout
    const output = await withTimeout(
      this.replicate.run(this.model as `${string}/${string}`, { input }),
      this.runTimeoutMs,
      "replicate.run"
    );

    const url = this.pickFirstUrl(output);
    if (!url) {
      throw new Error(`Replicate returned no URL output for model=${this.model}`);
    }

    // Step 2: Download with timeout
    const res = await withTimeout(
      fetch(url),
      this.downloadTimeoutMs,
      "replicate.download"
    );

    if (!res.ok) {
      throw new Error(`Failed to download replicate image: ${res.status} ${res.statusText}`);
    }

    // Step 3: Read array buffer (this is usually fast, but we include it in the download phase)
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  }

  private pickFirstUrl(output: unknown): string | null {
    return this.findUrl(output, 0);
  }

  private findUrl(v: unknown, depth: number): string | null {
    if (!v || depth > 3) return null;

    if (typeof v === "string") {
      return v.startsWith("http") ? v : null;
    }

    if (Array.isArray(v)) {
      for (const item of v) {
        const found = this.findUrl(item, depth + 1);
        if (found) return found;
      }
      return null;
    }

    if (typeof v === "object") {
      const o = v as Record<string, unknown>;

      // common keys
      const candidates = [
        o["output"], o["image"], o["images"], o["result"],
        o["url"], o["href"], o["uri"], o["file"], o["files"],
      ];

      for (const c of candidates) {
        const found = this.findUrl(c, depth + 1);
        if (found) return found;
      }

      // sometimes nested under "data"
      if (o["data"]) {
        const found = this.findUrl(o["data"], depth + 1);
        if (found) return found;
      }
    }

    return null;
  }
}
