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
  horny_courtroom: "COURT OF MARKET REALITY",
  horny_chart_autopsy: "CHART AUTOPSY REPORT",
  horny_ghost: "LIQUIDITY GHOST DETECTED",
  horny_certificate: "OFFICIAL CERTIFICATION",
  horny_trade_screen: "LIVE TRADING FOOTAGE"
};

const DEFAULT_FOOTERS: Partial<Record<TemplateKey, string>> = {
  horny_courtroom: "SENTENCED TO HOLDING",
  horny_chart_autopsy: "TIME OF DEATH: LIQUIDITY EVENT",
  horny_certificate: "ISSUED BY HORNY ENTITY",
  horny_trade_screen: "EMOTIONAL DAMAGE DETECTED"
};

const BANK: Record<TemplateKey, Record<string, string[]>> = {
  horny_courtroom: {
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
  horny_chart_autopsy: {
    title: ["CHART AUTOPSY REPORT", "MEMECOIN MORGUE REPORT", "RUG PULL NECROPSY"],
    cause: [
      "Cause of death: NARRATIVE INFLATION.",
      "Cause of death: ARTIFICIAL VOLUME POISONING.",
      "Cause of death: LIQUIDITY VANISHED SYNDROME.",
      "Cause of death: INFLUENCER THEATER OVERDOSE."
    ],
    footer: ["TIME OF DEATH: LIQUIDITY EVENT", "AUTOPSY COMPLETE — R.I.P.", "CAUSE: MARKET SAID NO"]
  },
  horny_ghost: {
    title: ["LIQUIDITY GHOST DETECTED", "CHART GRAVEYARD GHOST", "EXIT LIQUIDITY WRAITH"],
    subtitle: [
      "YOUR BAGS ARE HAUNTED FOREVER.",
      "THIS CHART IS SPIRITUALLY BEARISH.",
      "WASH VOLUME POLTERGEIST DETECTED.",
      "YOU SUMMONED VOLATILITY. CONGRATS."
    ]
  },
  horny_certificate: {
    title: ["OFFICIAL CERTIFICATION", "DEGENERACY DEGREE AWARDED", "REKT ACADEMY DIPLOMA"],
    body: ["THIS USER IS CERTIFIED", "DEGENERATE STATUS: CONFIRMED", "OFFICIALLY REKT"],
    rank: [
      "LIQUIDITY GHOST",
      "MARKET TRAUMA SURVIVOR",
      "CERTIFIED EXIT LIQUIDITY",
      "WASH TRADE DETECTOR",
      "DEAD COIN REVIVER"
    ],
    footer: ["ISSUED BY HORNY ENTITY", "VALID UNTIL NEXT RUG", "NO REFUNDS ON DEGENERACY"]
  },
  horny_trade_screen: {
    header: ["LIVE TRADING FOOTAGE", "LIQUIDATION LIVE CAM", "REKT SCREEN CAPTURE"],
    body: [
      "YOU REALLY PRESSED BUY AT ATH.",
      "MARKET SAID NO — YOU SAID YES.",
      "VOLUME FAKE — LOSS REAL.",
      "THIS IS NOT TRADING. IT’S PERFORMANCE ART.",
      "BUY HIGH, CRY FOREVER."
    ],
    footer: ["EMOTIONAL DAMAGE DETECTED", "MARKET WINS AGAIN", "BEAUTIFUL DISASTER"]
  }
};

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
  for (const [zone, arr] of Object.entries(BANK[t] ?? {})) {
    textByZone[zone] = pickOne(arr, rng);
  }

  // ensure mandatory zones
  if (t === "horny_courtroom") {
    textByZone.header = textByZone.header || pickOne(BANK.horny_courtroom.header, rng);
    textByZone.verdict = textByZone.verdict || pickOne(BANK.horny_courtroom.verdict, rng);
    textByZone.footer = textByZone.footer || pickOne(BANK.horny_courtroom.footer, rng);
  }
  if (t === "horny_chart_autopsy") {
    textByZone.title = textByZone.title || pickOne(BANK.horny_chart_autopsy.title, rng);
    textByZone.cause = textByZone.cause || pickOne(BANK.horny_chart_autopsy.cause, rng);
    textByZone.footer = textByZone.footer || pickOne(BANK.horny_chart_autopsy.footer, rng);
  }
  if (t === "horny_ghost") {
    textByZone.title = textByZone.title || pickOne(BANK.horny_ghost.title, rng);
    textByZone.subtitle = textByZone.subtitle || pickOne(BANK.horny_ghost.subtitle, rng);
  }
  if (t === "horny_certificate") {
    textByZone.title = textByZone.title || pickOne(BANK.horny_certificate.title, rng);
    textByZone.body = textByZone.body || pickOne(BANK.horny_certificate.body, rng);
    textByZone.rank = textByZone.rank || pickOne(BANK.horny_certificate.rank, rng);
    textByZone.footer = textByZone.footer || pickOne(BANK.horny_certificate.footer, rng);
  }
  if (t === "horny_trade_screen") {
    textByZone.header = textByZone.header || pickOne(BANK.horny_trade_screen.header, rng);
    textByZone.body = textByZone.body || pickOne(BANK.horny_trade_screen.body, rng);
    textByZone.footer = textByZone.footer || pickOne(BANK.horny_trade_screen.footer, rng);
  }

  return { template: t, rarity: pick.rarity, textByZone };
}
