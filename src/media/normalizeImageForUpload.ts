/**
 * Image Normalization for X Upload
 *
 * Resizes and compresses images to fit within X's 5MB limit.
 * Uses sharp for efficient processing.
 */

import sharp from "sharp";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB X limit
const DEFAULT_MAX_DIM = 1024;

export type NormalizedImage = {
  buffer: Buffer;
  mimeType: string;
  changed: boolean;
};

export class MediaNormalizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaNormalizationError";
  }
}

export async function normalizeImageForUpload(
  input: Buffer,
  mimeType: string,
  opts?: { maxDim?: number; maxBytes?: number }
): Promise<NormalizedImage> {
  const maxDim = opts?.maxDim ?? DEFAULT_MAX_DIM;
  const maxBytes = opts?.maxBytes ?? MAX_BYTES;

  // Fast path: already within limits
  if (input.length <= maxBytes) {
    return { buffer: input, mimeType, changed: false };
  }

  try {
    // 1) Resize to maxDim (contain, no upscaling)
    let img = sharp(input).resize(maxDim, maxDim, { fit: "inside", withoutEnlargement: true });

    // 2) Try lossless-ish first for PNG, then fallback to JPEG if still too big
    if (mimeType === "image/png") {
      let buf = await img.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
      if (buf.length <= maxBytes) {
        return { buffer: buf, mimeType: "image/png", changed: true };
      }

      // fallback to jpeg with good quality
      buf = await img.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      return { buffer: buf, mimeType: "image/jpeg", changed: true };
    }

    // For jpeg already, reduce quality
    if (mimeType === "image/jpeg") {
      const buf = await img.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
      return { buffer: buf, mimeType: "image/jpeg", changed: true };
    }

    // default: convert to jpeg
    const buf = await img.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    return { buffer: buf, mimeType: "image/jpeg", changed: true };
  } catch (err) {
    throw new MediaNormalizationError(
      `Failed to normalize image: ${err instanceof Error ? err.message : "unknown error"}`
    );
  }
}
