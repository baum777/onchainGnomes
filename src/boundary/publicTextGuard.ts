/**
 * Public Text Guard
 *
 * Defense-in-depth: ensures no internal metadata leaks to public tweets.
 * Throws before any text reaches X API.
 */

export type PublicGuardContext = {
  route: string;
};

export class PublicTextGuardError extends Error {
  constructor(
    message: string,
    public readonly violations: string[],
    public readonly context: PublicGuardContext
  ) {
    super(message);
    this.name = "PublicTextGuardError";
  }
}

// Forbidden internal tokens (case-insensitive)
const FORBIDDEN_TOKENS = [
  "score",
  "scores",
  "xp",
  "threshold",
  "cooldown",
  "trace",
  "telemetry",
  "flag",
  "flags",
  "risk_score",
  "level",
  "meta",
  "internal",
  "hash",
  "seed",
  "rng",
  "deterministic",
  "mode",
  "energy",
];

// JSON/internal payload markers (case-insensitive)
const JSON_MARKERS = [
  '"trace_id"',
  '"matrix_meta"',
  '"prompt_hash"',
  '"aggression"',
  '"score"',
  '"threshold"',
  '"cooldown"',
  '"flag"',
  '"mode"',
  '"energy"',
  '{"',
  '"}',
];

function findViolations(text: string): string[] {
  const violations: string[] = [];
  const lowerText = text.toLowerCase();

  // Check forbidden tokens
  for (const token of FORBIDDEN_TOKENS) {
    const regex = new RegExp(`\\b${token}\\b`, "i");
    if (regex.test(text)) {
      violations.push(`forbidden_token:${token}`);
    }
  }

  // Check JSON markers
  for (const marker of JSON_MARKERS) {
    if (lowerText.includes(marker.toLowerCase())) {
      violations.push(`json_marker:${marker}`);
    }
  }

  return violations;
}

/**
 * Asserts that text is safe for public consumption.
 * Throws PublicTextGuardError if any violations found.
 *
 * @param text - The text to validate
 * @param ctx - Context for error reporting (route name)
 * @throws PublicTextGuardError
 */
export function assertPublicTextSafe(text: string, ctx: PublicGuardContext): void {
  const violations = findViolations(text);

  if (violations.length > 0) {
    // Log only route and reason, never the text itself
    console.error(`[PublicTextGuard] BLOCKED at ${ctx.route}: violations=${violations.join(",")}`);

    throw new PublicTextGuardError(
      `Text contains ${violations.length} violation(s): ${violations.join(", ")}`,
      violations,
      ctx
    );
  }
}

/**
 * Check if text is safe without throwing.
 * Returns violations if any.
 */
export function checkPublicTextSafe(text: string): { safe: boolean; violations: string[] } {
  const violations = findViolations(text);
  return { safe: violations.length === 0, violations };
}
