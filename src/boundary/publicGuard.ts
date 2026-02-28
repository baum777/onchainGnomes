export type GuardContext = {
  route?: string;
  source?: string;
};

export class PublicGuardError extends Error {
  constructor(
    message: string,
    public readonly violations: string[],
    public readonly context?: GuardContext
  ) {
    super(message);
    this.name = "PublicGuardError";
  }
}

// Forbidden tokens that must never appear in public output (case-insensitive)
const FORBIDDEN_TOKENS = [
  "score",
  "xp",
  "threshold",
  "cooldown",
  "trace",
  "risk",
  "telemetry",
  "flag",
  "level",
  "rarity",
  "combo",
  "mythic",
  "epic",
  "internal",
  "meta",
  "seed",
  "rng",
  "hash",
];

// Additional tokens blocked specifically for badge route
const BADGE_FORBIDDEN = [
  "rank",
  "points",
  "tier",
  "grade",
  "rating",
];

function findViolations(text: string, extraTokens: string[] = []): string[] {
  const lowerText = text.toLowerCase();
  const violations: string[] = [];
  const allForbidden = [...FORBIDDEN_TOKENS, ...extraTokens];

  for (const token of allForbidden) {
    // Match whole words only
    const regex = new RegExp(`\\b${token}\\b`, "i");
    if (regex.test(lowerText)) {
      violations.push(token);
    }
  }

  return violations;
}

function containsDigits(text: string): boolean {
  return /\d/.test(text);
}

/**
 * Asserts that text is safe for public consumption.
 * Blocks forbidden internal tokens and (for /badge route) any digits.
 *
 * @param text - The text to validate
 * @param context - Optional context including route information
 * @throws PublicGuardError if violations found
 */
export function assertPublicSafe(text: string, context?: GuardContext): void {
  const violations: string[] = [];

  // Check forbidden tokens
  const extraTokens = context?.route === "/badge" ? BADGE_FORBIDDEN : [];
  const tokenViolations = findViolations(text, extraTokens);
  violations.push(...tokenViolations);

  // For /badge route, also block any digits
  if (context?.route === "/badge" && containsDigits(text)) {
    violations.push("<contains_digits>");
  }

  if (violations.length > 0) {
    throw new PublicGuardError(
      `Public safety violation${violations.length > 1 ? "s" : ""}: ${violations.join(", ")}`,
      violations,
      context
    );
  }
}

/**
 * Sanitizes text by removing internal tokens (best effort).
 * Prefer assertPublicSafe for strict enforcement.
 */
export function sanitizeForPublic(text: string): string {
  let sanitized = text;

  for (const token of FORBIDDEN_TOKENS) {
    const regex = new RegExp(`\\b${token}\\b`, "gi");
    sanitized = sanitized.replace(regex, "[REDACTED]");
  }

  return sanitized;
}

/**
 * Checks if text is safe without throwing.
 */
export function isPublicSafe(text: string, context?: GuardContext): boolean {
  try {
    assertPublicSafe(text, context);
    return true;
  } catch {
    return false;
  }
}
