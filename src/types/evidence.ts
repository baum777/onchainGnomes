/**
 * Evidence Types - Standardized Proof Objects
 * 
 * Defines the standardized Evidence format for all tool results.
 * Every factual claim must be backed by an Evidence object.
 */

import { z } from "zod";

// =============================================================================
// Evidence Source
// =============================================================================

export const EvidenceSourceSchema = z.enum([
  "solana_rpc",
  "helius",
  "moralis",
  "dexscreener",
  "gecko_terminal",
  "internal",
  "merged",
]);

export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

// =============================================================================
// Standardized Evidence (Proof Object)
// =============================================================================

export const EvidenceSchema = z.object({
  source: EvidenceSourceSchema,
  endpoint: z.string(),
  timestamp: z.string().datetime(),
  slot: z.number().nullable().optional(),
  signature: z.string().nullable().optional(),
  rawHash: z.string().optional(),
  notes: z.string().optional(),
});

export interface Evidence {
  source: EvidenceSource;
  endpoint: string;
  timestamp: string;
  slot?: number | null;
  signature?: string | null;
  rawHash?: string;
  notes?: string;
}

// =============================================================================
// Verification Status
// =============================================================================

export const VerificationStatusSchema = z.enum([
  "VERIFIED",
  "PARTIAL",
  "UNVERIFIED",
]);

export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

// =============================================================================
// Verification Result with Confidence
// =============================================================================

export const VerificationResultSchema = z.object({
  status: VerificationStatusSchema,
  confidence: z.number().min(0).max(1),
  ca: z.string().nullable(),
  evidence: z.array(EvidenceSchema),
  flags: z.array(z.string()),
  onchainData: z.object({
    mintInfo: z.any().nullable(),
    supply: z.any().nullable(),
    largestAccounts: z.any().nullable(),
  }),
  marketData: z.any().nullable(),
  timestamp: z.string().datetime(),
  latencyMs: z.number().int().min(0),
});

export interface VerificationResult {
  status: VerificationStatus;
  confidence: number;
  ca: string | null;
  evidence: Evidence[];
  flags: string[];
  onchainData: {
    mintInfo: unknown | null;
    supply: unknown | null;
    largestAccounts: unknown | null;
  };
  marketData: unknown | null;
  timestamp: string;
  latencyMs: number;
}

// =============================================================================
// Output Classification
// =============================================================================

export const OutputClassificationSchema = z.enum([
  "FACT",
  "UNVERIFIED",
  "OPINION",
  "ERROR",
]);

export type OutputClassification = z.infer<typeof OutputClassificationSchema>;

// =============================================================================
// Confidence Thresholds
// =============================================================================

export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.85,
  MEDIUM: 0.60,
  LOW: 0.30,
} as const;

export function classifyByConfidence(confidence: number): VerificationStatus {
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return "VERIFIED";
  }
  if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return "PARTIAL";
  }
  return "UNVERIFIED";
}

export function classifyOutput(
  success: boolean,
  hasEvidence: boolean,
  confidence: number
): OutputClassification {
  if (!success) {
    return "ERROR";
  }
  if (!hasEvidence || confidence < CONFIDENCE_THRESHOLDS.MEDIUM) {
    return "UNVERIFIED";
  }
  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return "FACT";
  }
  return "OPINION";
}

// =============================================================================
// Evidence Builder
// =============================================================================

export interface EvidenceBuilder {
  source: EvidenceSource;
  endpoint: string;
  slot?: number | null;
  signature?: string | null;
  rawHash?: string;
  notes?: string;
}

export function createEvidence(builder: EvidenceBuilder): Evidence {
  return {
    source: builder.source,
    endpoint: builder.endpoint,
    timestamp: new Date().toISOString(),
    slot: builder.slot ?? null,
    signature: builder.signature ?? null,
    rawHash: builder.rawHash,
    notes: builder.notes,
  };
}

export function createMergedEvidence(
  sources: Evidence[],
  endpoint: string = "merged",
  notes?: string
): Evidence {
  const timestamps = sources.map((e) => new Date(e.timestamp).getTime());
  const latestTimestamp = new Date(Math.max(...timestamps)).toISOString();
  
  // Create a hash of all source hashes
  const combinedRaw = sources.map((e) => e.rawHash || e.timestamp).join("|");
  const rawHash = hashString(combinedRaw);
  
  return {
    source: "merged",
    endpoint,
    timestamp: latestTimestamp,
    slot: null,
    signature: null,
    rawHash,
    notes: notes || `Merged ${sources.length} evidence sources`,
  };
}

// Simple hash function for evidence integrity
function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

// =============================================================================
// Evidence Validation
// =============================================================================

export function validateEvidence(evidence: Evidence): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!evidence.source) {
    errors.push("Evidence missing source");
  }
  
  if (!evidence.endpoint) {
    errors.push("Evidence missing endpoint");
  }
  
  if (!evidence.timestamp) {
    errors.push("Evidence missing timestamp");
  } else {
    const timestamp = new Date(evidence.timestamp);
    if (isNaN(timestamp.getTime())) {
      errors.push("Evidence has invalid timestamp");
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function hasValidEvidence(
  evidence: Evidence[] | null | undefined
): boolean {
  if (!evidence || evidence.length === 0) {
    return false;
  }
  return evidence.every((e) => validateEvidence(e).valid);
}

// =============================================================================
// Evidence Comparison
// =============================================================================

export function evidenceIsStale(
  evidence: Evidence,
  maxAgeMs: number = 60000
): boolean {
  const evidenceTime = new Date(evidence.timestamp).getTime();
  const now = Date.now();
  return now - evidenceTime > maxAgeMs;
}

export function compareEvidenceTimestamps(
  a: Evidence,
  b: Evidence
): number {
  return (
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}
