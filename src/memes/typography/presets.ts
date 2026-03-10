import { TextZoneSpec } from "./types.js";
import { TemplateKey } from "../rarity.js";

const baseFont = "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial";
const heavy = 800;
const med = 600;

export const ZONE_PRESETS: Record<TemplateKey, TextZoneSpec[]> = {
  twimsalot_courtroom: [
    { key: "header", rect: { x: 80, y: 60, w: 864, h: 120 }, maxLines: 2, fontFamily: baseFont, fontWeight: heavy, align: "center", baseline: "middle", padding: 10, minFont: 28, maxFont: 56, lineHeight: 1.05, transform: "uppercase" },
    { key: "verdict", rect: { x: 90, y: 240, w: 844, h: 520 }, maxLines: 6, fontFamily: baseFont, fontWeight: heavy, align: "center", baseline: "middle", padding: 18, minFont: 28, maxFont: 64, lineHeight: 1.12 },
    { key: "footer", rect: { x: 90, y: 820, w: 844, h: 140 }, maxLines: 2, fontFamily: baseFont, fontWeight: med, align: "center", baseline: "middle", padding: 12, minFont: 22, maxFont: 40, lineHeight: 1.1, transform: "uppercase" }
  ],

  twimsalot_chart_autopsy: [
    { key: "title", rect: { x: 90, y: 70, w: 844, h: 140 }, maxLines: 2, fontFamily: baseFont, fontWeight: heavy, align: "center", baseline: "middle", padding: 12, minFont: 30, maxFont: 60, lineHeight: 1.05, transform: "uppercase" },
    { key: "cause", rect: { x: 110, y: 300, w: 804, h: 420 }, maxLines: 7, fontFamily: baseFont, fontWeight: heavy, align: "left", baseline: "top", padding: 14, minFont: 26, maxFont: 54, lineHeight: 1.15 },
    { key: "footer", rect: { x: 90, y: 820, w: 844, h: 140 }, maxLines: 2, fontFamily: baseFont, fontWeight: med, align: "center", baseline: "middle", padding: 12, minFont: 20, maxFont: 38, lineHeight: 1.1, transform: "uppercase" }
  ],

  twimsalot_ghost: [
    { key: "title", rect: { x: 90, y: 70, w: 844, h: 140 }, maxLines: 2, fontFamily: baseFont, fontWeight: heavy, align: "center", baseline: "middle", padding: 12, minFont: 30, maxFont: 62, lineHeight: 1.05, transform: "uppercase" },
    { key: "subtitle", rect: { x: 110, y: 260, w: 804, h: 560 }, maxLines: 7, fontFamily: baseFont, fontWeight: heavy, align: "center", baseline: "middle", padding: 16, minFont: 26, maxFont: 58, lineHeight: 1.12 }
  ],

  twimsalot_certificate: [
    { key: "title", rect: { x: 90, y: 80, w: 844, h: 120 }, maxLines: 2, fontFamily: baseFont, fontWeight: heavy, align: "center", baseline: "middle", padding: 12, minFont: 28, maxFont: 54, lineHeight: 1.05, transform: "uppercase" },
    { key: "body", rect: { x: 120, y: 260, w: 784, h: 120 }, maxLines: 2, fontFamily: baseFont, fontWeight: med, align: "center", baseline: "middle", padding: 10, minFont: 22, maxFont: 38, lineHeight: 1.1, transform: "uppercase" },
    { key: "rank", rect: { x: 110, y: 410, w: 804, h: 360 }, maxLines: 5, fontFamily: baseFont, fontWeight: heavy, align: "center", baseline: "middle", padding: 18, minFont: 30, maxFont: 72, lineHeight: 1.08, transform: "uppercase" },
    { key: "footer", rect: { x: 90, y: 820, w: 844, h: 140 }, maxLines: 2, fontFamily: baseFont, fontWeight: med, align: "center", baseline: "middle", padding: 12, minFont: 18, maxFont: 34, lineHeight: 1.1 }
  ],

  twimsalot_trade_screen: [
    { key: "header", rect: { x: 90, y: 70, w: 844, h: 130 }, maxLines: 2, fontFamily: baseFont, fontWeight: heavy, align: "left", baseline: "middle", padding: 12, minFont: 28, maxFont: 56, lineHeight: 1.05, transform: "uppercase" },
    { key: "body", rect: { x: 110, y: 240, w: 804, h: 520 }, maxLines: 7, fontFamily: baseFont, fontWeight: heavy, align: "left", baseline: "top", padding: 14, minFont: 26, maxFont: 60, lineHeight: 1.15 },
    { key: "footer", rect: { x: 90, y: 820, w: 844, h: 140 }, maxLines: 2, fontFamily: baseFont, fontWeight: med, align: "right", baseline: "middle", padding: 12, minFont: 18, maxFont: 34, lineHeight: 1.1, transform: "uppercase" }
  ]
};
