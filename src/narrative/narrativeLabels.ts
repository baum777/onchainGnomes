/**
 * Narrative Labels — Gorky narrative taxonomy for roast pattern mapping.
 * Used by narrativeMapper and patternEngine to classify crypto Twitter content.
 */

export const NARRATIVE_LABELS = [
  "this_cycle_different",
  "utility_revolution",
  "meme_viral_launch",
  "healthy_correction",
  "ai_defi_rwa_meta",
  "liquidity_volume_spike",
  "hopium_wagmi_diamond_hands",
  "rug_scam_fear",
  "post_hype_silence",
  "chain_superiority",
  "influencer_pump",
  "recycled_macro_thesis",
  "unclassified",
] as const;

export type NarrativeLabel = (typeof NARRATIVE_LABELS)[number];

export type SentimentLabel = "positive" | "negative" | "neutral";

export interface NarrativeKeywords {
  label: NarrativeLabel;
  keywords: RegExp[];
  /** Optional: secondary patterns that boost confidence */
  boosters?: RegExp[];
}

/** Keyword patterns per narrative. Order matters for tie-breaking (first match wins). */
export const NARRATIVE_KEYWORDS: NarrativeKeywords[] = [
  {
    label: "this_cycle_different",
    keywords: [
      /\bthis\s+cycle\s+is\s+different\b/i,
      /\bthis\s+time\s+is\s+different\b/i,
      /\bnew\s+paradigm\b/i,
      /\bstructural\s+shift\b/i,
    ],
  },
  {
    label: "utility_revolution",
    keywords: [
      /\butility\s+(?:will\s+)?win\b/i,
      /\breal\s+utility\b/i,
      /\butility\s+revolution\b/i,
      /\bdefi\s+2\.0\b/i,
      /\brevolutionary\s+(?:defi|tech)\b/i,
    ],
  },
  {
    label: "meme_viral_launch",
    keywords: [
      /\bmeme\s+(?:season|szn|coin)\b/i,
      /\bviral\s+launch\b/i,
      /\bstealth\s+launch\b/i,
      /\bfair\s+launch\b/i,
      /\bjust\s+launched\b/i,
      /\blfg\b/i,
    ],
  },
  {
    label: "healthy_correction",
    keywords: [
      /\bhealthy\s+correction\b/i,
      /\bbuy\s+the\s+dip\b/i,
      /\baccumulation\s+phase\b/i,
      /\bconsolidation\b/i,
    ],
  },
  {
    label: "ai_defi_rwa_meta",
    keywords: [
      /\bai\s*\+\s*defi\b/i,
      /\brwa\b/i,
      /\breal\s+world\s+assets\b/i,
      /\bmeta\s+narrative\b/i,
    ],
  },
  {
    label: "liquidity_volume_spike",
    keywords: [
      /\bvolume\s+spike\b/i,
      /\bliquidity\s+(?:pump|surge)\b/i,
      /\b10x\s+(?:in\s+)?\d+\s*(?:min|hour)s?\b/i,
      /\bbreaking\s+out\b/i,
    ],
  },
  {
    label: "hopium_wagmi_diamond_hands",
    keywords: [
      /\bwagmi\b/i,
      /\bdiamond\s+hands\b/i,
      /\bhopium\b/i,
      /\b100x\s+incoming\b/i,
      /\bthis\s+is\s+the\s+one\b/i,
      /\bguaranteed\b/i,
    ],
  },
  {
    label: "rug_scam_fear",
    keywords: [
      /\brug\b/i,
      /\bscam\b/i,
      /\brugpull\b/i,
      /\bhoneypot\b/i,
      /\bdev\s+(?:sold|dumped)\b/i,
    ],
  },
  {
    label: "post_hype_silence",
    keywords: [
      /\bcrickets\b/i,
      /\bsilence\s+after\b/i,
      /\bpost\s+(?:launch|pump)\b/i,
      /\bdead\s+chat\b/i,
      /\bno\s+volume\b/i,
    ],
  },
  {
    label: "chain_superiority",
    keywords: [
      /\bsolana\s+(?:>|vs|better)\b/i,
      /\beth\s+(?:is|will)\s+die\b/i,
      /\b(?:sol|eth|btc)\s+superior\b/i,
      /\bchain\s+war\b/i,
    ],
  },
  {
    label: "influencer_pump",
    keywords: [
      /\binfluencer\s+(?:backed|promo)\b/i,
      /\b(?:cto|ceo|whale)\s+ape\b/i,
      /\bbacked\s+by\b/i,
      /\bpartner\s+announcement\b/i,
    ],
  },
  {
    label: "recycled_macro_thesis",
    keywords: [
      /\bmacro\s+cycle\b/i,
      /\binterest\s+rate\b/i,
      /\bfed\s+(?:pivot|cut)\b/i,
      /\bhalving\s+narrative\b/i,
      /\bseen\s+this\s+movie\b/i,
    ],
  },
];
