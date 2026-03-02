/**
 * Topic Lexikon - NLP-guided Bildmetaphern
 *
 * 45 Keywords zu visuellen Metaphern gemappt.
 * Optimiert für Grok/Replicate Image Prompts im Crypto/Meme Kontext.
 */

export type VisualMetaphor = string;

// MARKT-DYNAMIK (1-10)
const MARKET_DYNAMICS: Record<string, VisualMetaphor> = {
  crash: "zerbrechende Candles wie Glas, fallende Pfeile, Boden mit Rissen",
  dump: "schmelzende rote Kerzen, tropfender Chart",
  rug: "Boden klappt auf, Liquidität verschwindet in dunklem Loch",
  pump: "aufgeblasene grüne Kerzen wie Ballons, Raketenpfeil",
  breakout: "Chart durchbricht leuchtende Glasdecke",
  resistance: "massive neon Wand, Kerzen prallen ab",
  support: "leuchtendes Fundament unter dem Chart",
  fakeout: "Chart durchbricht Wand, wird sofort zurückgeschleudert",
  consolidation: "Chart in transparentem Käfig",
  volatility: "Zitternde Kerzen, elektrische Blitze um Linien",
};

// HYPE / EMOTION (11-17)
const HYPE_EMOTION: Record<string, VisualMetaphor> = {
  FOMO: "Schattenfigur rennt einer Rakete hinterher",
  euphoria: "Überdimensionale grüne Explosion, konfettiartige Tokens",
  panic: "Kerzen brennen unkontrolliert, Alarm-Symbole",
  disbelief: "Halbtransparenter Chart mit verzerrtem Spiegelbild",
  greed: "Chart verwandelt sich in Goldmünzen-Schlange",
  fear: "Nebel um fallende Linien",
  hope: "dünner Lichtstrahl unter rotem Chaos",
};

// LIQUIDITÄT / TOKEN (18-24)
const LIQUIDITY_TOKEN: Record<string, VisualMetaphor> = {
  liquidity: "leuchtende Flüsse, die unter dem Chart fließen",
  airdrop: "Tokens fallen mit Fallschirmen",
  staking: "Token an Ketten befestigt, stabil verankert",
  burn: "Token zerfällt zu Aschepartikeln",
  mint: "Token entsteht aus leuchtendem Kreis",
  supply: "endlose Token-Reihe im Hintergrund",
  scarcity: "einzelner Token in leerem Raum",
};

// TRADING-VERHALTEN (25-31)
const TRADING_BEHAVIOR: Record<string, VisualMetaphor> = {
  overleveraged: "Chart auf wackeliger Leiter",
  liquidation: "Figur fällt durch Chart in Abgrund",
  long: "grüner Pfeil als Speer nach oben",
  short: "roter Pfeil bohrt nach unten",
  bagholder: "Figur trägt schwere rote Kerze auf dem Rücken",
  "diamond hands": "Hände aus Kristall halten glühenden Token",
  "paper hands": "Papierhände zerreißen beim Druck",
};

// MEME / CHAOS (32-37)
const MEME_CHAOS: Record<string, VisualMetaphor> = {
  degen: "Kritzelhafte Figur mit übergroßen Augen vor flackernden Charts",
  alpha: "leuchtender Schlüssel über Chart",
  insider: "Schattenfigur flüstert in leuchtenden Chart",
  "exit liquidity": "Neon-Tor mit Exit-Symbol, andere fallen hinein",
  narrative: "Chart in Form einer Maske",
  "echo chamber": "Charts reflektieren sich in Kreis-Spiegeln",
};

// TECH / INFRA (38-42)
const TECH_INFRA: Record<string, VisualMetaphor> = {
  network: "Verbundene Nodes über Chart",
  gas: "brennende kleine Funken entlang Linien",
  bot: "mechanische Augen beobachten Chart",
  exploit: "Riss im Chart, durch den Daten austreten",
  freeze: "Chart in Eis eingefroren",
};

// GORKY SIGNATURE THEMES (43-45)
const GORKY_THEMES: Record<string, VisualMetaphor> = {
  troll: "grinsende Silhouette beobachtet Chaos",
  chaos: "Neon-Kritzelstürme um Candles",
  dominance: "Gorky größer als Chart, steht darüber",
};

// ERWEITERTE VISUELLE TRIGGER (46-50)
const EXTENDED_TRIGGERS: Record<string, VisualMetaphor> = {
  comeback: "zerstörter Chart wächst neu aus Licht",
  manipulation: "unsichtbare Fäden ziehen Candles",
  sideways: "Kerzen laufen auf Laufband",
  "breakout trap": "Chart durchbricht Wand, landet im Netz",
  capitulation: "Kerzen zerfallen zu Staub, Boden bleibt leer",
};

// Default Metaphoren wenn keine Keywords matchen
export const DEFAULT_METAPHORS: VisualMetaphor[] = [
  "broken candlestick charts",
  "floating arrows",
  "chaotic scribble symbols",
];

// Komplettes Lexikon zusammenführen
export const TOPIC_LEXICON: Record<string, VisualMetaphor> = {
  ...MARKET_DYNAMICS,
  ...HYPE_EMOTION,
  ...LIQUIDITY_TOKEN,
  ...TRADING_BEHAVIOR,
  ...MEME_CHAOS,
  ...TECH_INFRA,
  ...GORKY_THEMES,
  ...EXTENDED_TRIGGERS,
};

// Keywords nach Kategorie (für debugging/dokumentation)
export const LEXICON_CATEGORIES = {
  MARKET_DYNAMICS: Object.keys(MARKET_DYNAMICS),
  HYPE_EMOTION: Object.keys(HYPE_EMOTION),
  LIQUIDITY_TOKEN: Object.keys(LIQUIDITY_TOKEN),
  TRADING_BEHAVIOR: Object.keys(TRADING_BEHAVIOR),
  MEME_CHAOS: Object.keys(MEME_CHAOS),
  TECH_INFRA: Object.keys(TECH_INFRA),
  GORKY_THEMES: Object.keys(GORKY_THEMES),
  EXTENDED_TRIGGERS: Object.keys(EXTENDED_TRIGGERS),
};

/**
 * Lookup Metapher für ein Keyword
 */
export function getMetaphor(keyword: string): VisualMetaphor | undefined {
  return TOPIC_LEXICON[keyword.toLowerCase()];
}

/**
 * Mappe Array von Keywords auf ihre Metaphern
 * Limitiert auf max 3 (verhindert visuelles Chaos)
 */
export function mapKeywordsToMetaphors(
  keywords: string[],
  maxMetaphors = 3
): VisualMetaphor[] {
  const metaphors = keywords
    .map((k) => getMetaphor(k.toLowerCase()))
    .filter((m): m is VisualMetaphor => m !== undefined)
    .slice(0, maxMetaphors);

  return metaphors;
}

/**
 * Kombiniere mehrere Metaphern zu einem Include-String
 */
export function combineMetaphors(metaphors: VisualMetaphor[]): string {
  return metaphors.join("; ");
}

/**
 * Prüfe ob ein Keyword im Lexikon existiert
 */
export function hasMetaphor(keyword: string): boolean {
  return keyword.toLowerCase() in TOPIC_LEXICON;
}
