import { pickTemplate } from "./templates.js";
import { maybePickCombo } from "./combos.js";
import { pickOne, RNG } from "./dice.js";
import { TemplateKey } from "./rarity.js";

export type MemeText = {
  template: TemplateKey;
  rarity: string; // keep internal; don't tweet
  textByZone: Record<string, string>;
};

const DEFAULT_HEADERS: Partial<Record<TemplateKey, string>> = {
  gorkypf_courtroom: "COURT OF MARKET REALITY",
  gorkypf_chart_autopsy: "CHART AUTOPSY REPORT",
  gorkypf_ghost: "LIQUIDITY GHOST DETECTED",
  gorkypf_certificate: "OFFICIAL CERTIFICATION",
  gorkypf_trade_screen: "LIVE TRADING FOOTAGE"
};

const DEFAULT_FOOTERS: Partial<Record<TemplateKey, string>> = {
  gorkypf_courtroom: "SENTENCED TO HOLDING",
  gorkypf_chart_autopsy: "TIME OF DEATH: LIQUIDITY EVENT",
  gorkypf_certificate: "ISSUED BY gorkypf ENTITY",
  gorkypf_trade_screen: "EMOTIONAL DAMAGE DETECTED"
};

const BANK: Record<TemplateKey, Record<string, string[]>> = {
  gorkypf_courtroom: {
    verdict: [
      "VERDICT: GUILTY OF VIBES-BASED INVESTING.",
      "VERDICT: CONFIDENCE EXCEEDED SKILL.",
      "VERDICT: LIQUIDITY GHOSTED OVERNIGHT.",
      "VERDICT: BUY HIGH, CRY FOREVER.",
      "VERDICT: WASH VOLUME WORSHIP."
    ],
    header: [
      "COURT OF MARKET REALITY",
      "RUG PULL TRIBUNAL",
      "FOMO FELONY COURT"
    ],
    footer: [
      "SENTENCED TO HOLDING",
      "EXIT LIQUIDITY CONFIRMED",
      "NO PAROLE FROM BAGS"
    ]
  },
  gorkypf_chart_autopsy: {
    title: ["CHART AUTOPSY REPORT", "MEMECOIN MORGUE REPORT", "RUG PULL NECROPSY"],
    cause: [
      "Cause of death: NARRATIVE INFLATION.",
      "Cause of death: ARTIFICIAL VOLUME POISONING.",
      "Cause of death: LIQUIDITY VANISHED SYNDROME.",
      "Cause of death: INFLUENCER THEATER OVERDOSE."
    ],
    footer: ["TIME OF DEATH: LIQUIDITY EVENT", "AUTOPSY COMPLETE — R.I.P.", "CAUSE: MARKET SAID NO"]
  },
  gorkypf_ghost: {
    title: ["LIQUIDITY GHOST DETECTED", "CHART GRAVEYARD GHOST", "EXIT LIQUIDITY WRAITH"],
    subtitle: [
      "YOUR BAGS ARE HAUNTED FOREVER.",
      "THIS CHART IS SPIRITUALLY BEARISH.",
      "WASH VOLUME POLTERGEIST DETECTED.",
      "YOU SUMMONED VOLATILITY. CONGRATS."
    ]
  },
  gorkypf_certificate: {
    title: ["OFFICIAL CERTIFICATION", "DEGENERACY DEGREE AWARDED", "REKT ACADEMY DIPLOMA"],
    body: ["THIS USER IS CERTIFIED", "DEGENERATE STATUS: CONFIRMED", "OFFICIALLY REKT"],
    rank: [
      "LIQUIDITY GHOST",
      "MARKET TRAUMA SURVIVOR",
      "CERTIFIED EXIT LIQUIDITY",
      "WASH TRADE DETECTOR",
      "DEAD COIN REVIVER"
    ],
    footer: ["ISSUED BY gorkypf ENTITY", "VALID UNTIL NEXT RUG", "NO REFUNDS ON DEGENERACY"]
  },
  gorkypf_trade_screen: {
    header: ["LIVE TRADING FOOTAGE", "LIQUIDATION LIVE CAM", "REKT SCREEN CAPTURE"],
    body: [
      "YOU REALLY PRESSED BUY AT ATH.",
      "MARKET SAID NO — YOU SAID YES.",
      "VOLUME FAKE — LOSS REAL.",
      "THIS IS NOT TRADING. IT'S PERFORMANCE ART.",
      "BUY HIGH, CRY FOREVER."
    ],
    footer: ["EMOTIONAL DAMAGE DETECTED", "MARKET WINS AGAIN", "BEAUTIFUL DISASTER"]
  }
};

// Helper to safely get bank entry
function getBankEntry(template: TemplateKey, zone: string): string[] | undefined {
  return BANK[template]?.[zone];
}

export function buildMemeText(args: {
  userId: string;
  eligibleForHighRarity: boolean;
  rarityCountsLast24h?: any;
  rng?: RNG;
}): MemeText {
  const rng = args.rng ?? Math.random;

  const combo = maybePickCombo(rng);
  if (combo) return { template: combo.template, rarity: "COMBO", textByZone: combo.textByZone };

  const pick = pickTemplate(
    {
      userId: args.userId,
      eligibleForHighRarity: args.eligibleForHighRarity,
      rarityCountsLast24h: args.rarityCountsLast24h
    },
    undefined,
    rng
  );

  const t = pick.template;
  const textByZone: Record<string, string> = {};

  // default header/footer
  const h = DEFAULT_HEADERS[t];
  const f = DEFAULT_FOOTERS[t];
  if (h) textByZone.header = h;
  if (f) textByZone.footer = f;

  // fill per template
  const bank = BANK[t];
  for (const [zone, arr] of Object.entries(bank ?? {})) {
    textByZone[zone] = pickOne(arr, rng);
  }

  // ensure mandatory zones with safe fallbacks
  if (t === "gorkypf_courtroom") {
    const headerOpts = getBankEntry(t, "header");
    const verdictOpts = getBankEntry(t, "verdict");
    const footerOpts = getBankEntry(t, "footer");
    if (headerOpts) textByZone.header = textByZone.header || pickOne(headerOpts, rng);
    if (verdictOpts) textByZone.verdict = textByZone.verdict || pickOne(verdictOpts, rng);
    if (footerOpts) textByZone.footer = textByZone.footer || pickOne(footerOpts, rng);
  }
  if (t === "gorkypf_chart_autopsy") {
    const titleOpts = getBankEntry(t, "title");
    const causeOpts = getBankEntry(t, "cause");
    const footerOpts = getBankEntry(t, "footer");
    if (titleOpts) textByZone.title = textByZone.title || pickOne(titleOpts, rng);
    if (causeOpts) textByZone.cause = textByZone.cause || pickOne(causeOpts, rng);
    if (footerOpts) textByZone.footer = textByZone.footer || pickOne(footerOpts, rng);
  }
  if (t === "gorkypf_ghost") {
    const titleOpts = getBankEntry(t, "title");
    const subtitleOpts = getBankEntry(t, "subtitle");
    if (titleOpts) textByZone.title = textByZone.title || pickOne(titleOpts, rng);
    if (subtitleOpts) textByZone.subtitle = textByZone.subtitle || pickOne(subtitleOpts, rng);
  }
  if (t === "gorkypf_certificate") {
    const titleOpts = getBankEntry(t, "title");
    const bodyOpts = getBankEntry(t, "body");
    const rankOpts = getBankEntry(t, "rank");
    const footerOpts = getBankEntry(t, "footer");
    if (titleOpts) textByZone.title = textByZone.title || pickOne(titleOpts, rng);
    if (bodyOpts) textByZone.body = textByZone.body || pickOne(bodyOpts, rng);
    if (rankOpts) textByZone.rank = textByZone.rank || pickOne(rankOpts, rng);
    if (footerOpts) textByZone.footer = textByZone.footer || pickOne(footerOpts, rng);
  }
  if (t === "gorkypf_trade_screen") {
    const headerOpts = getBankEntry(t, "header");
    const bodyOpts = getBankEntry(t, "body");
    const footerOpts = getBankEntry(t, "footer");
    if (headerOpts) textByZone.header = textByZone.header || pickOne(headerOpts, rng);
    if (bodyOpts) textByZone.body = textByZone.body || pickOne(bodyOpts, rng);
    if (footerOpts) textByZone.footer = textByZone.footer || pickOne(footerOpts, rng);
  }

  return { template: t, rarity: pick.rarity, textByZone };
}
