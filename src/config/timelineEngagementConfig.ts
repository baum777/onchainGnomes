export interface TimelineEngagementConfig {
  enabled: boolean;
  intervalMs: number;
  maxPerRun: number;
  maxPerHour: number;
  maxPerDay: number;
  minContextScore: number;
  minFinalScore: number;
  requireThreadStructure: boolean;
  sourceAccounts: string[];
  keywordFilters: string[];
  authorCooldownMinutes: number;
  conversationCooldownMinutes: number;
}

const DEFAULTS: TimelineEngagementConfig = {
  enabled: false,
  intervalMs: 10 * 60_000,
  maxPerRun: 2,
  maxPerHour: 3,
  maxPerDay: 12,
  minContextScore: 55,
  minFinalScore: 60,
  requireThreadStructure: false,
  sourceAccounts: [],
  keywordFilters: [],
  authorCooldownMinutes: 180,
  conversationCooldownMinutes: 120,
};

function parseCsv(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((v) => v.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);
}

function parseNumber(input: string | undefined, fallback: number, min: number): number {
  if (!input) return fallback;
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, parsed);
}

export function readTimelineEngagementConfig(): TimelineEngagementConfig {
  return {
    enabled: (process.env.TIMELINE_ENGAGEMENT_ENABLED ?? String(DEFAULTS.enabled)) === "true",
    intervalMs: parseNumber(process.env.TIMELINE_ENGAGEMENT_INTERVAL_MS, DEFAULTS.intervalMs, 60_000),
    maxPerRun: Math.min(3, parseNumber(process.env.TIMELINE_ENGAGEMENT_MAX_PER_RUN, DEFAULTS.maxPerRun, 1)),
    maxPerHour: parseNumber(process.env.TIMELINE_ENGAGEMENT_MAX_PER_HOUR, DEFAULTS.maxPerHour, 1),
    maxPerDay: parseNumber(process.env.TIMELINE_ENGAGEMENT_MAX_PER_DAY, DEFAULTS.maxPerDay, 1),
    minContextScore: parseNumber(process.env.TIMELINE_MIN_CONTEXT_SCORE, DEFAULTS.minContextScore, 0),
    minFinalScore: parseNumber(process.env.TIMELINE_MIN_FINAL_SCORE, DEFAULTS.minFinalScore, 0),
    requireThreadStructure:
      (process.env.TIMELINE_REQUIRE_THREAD_STRUCTURE ?? String(DEFAULTS.requireThreadStructure)) === "true",
    sourceAccounts: parseCsv(process.env.TIMELINE_SOURCE_ACCOUNTS),
    keywordFilters: parseCsv(process.env.TIMELINE_KEYWORD_FILTERS),
    authorCooldownMinutes: parseNumber(
      process.env.TIMELINE_AUTHOR_COOLDOWN_MINUTES,
      DEFAULTS.authorCooldownMinutes,
      1
    ),
    conversationCooldownMinutes: parseNumber(
      process.env.TIMELINE_CONVERSATION_COOLDOWN_MINUTES,
      DEFAULTS.conversationCooldownMinutes,
      1
    ),
  };
}
