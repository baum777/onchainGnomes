export type Rect = { x: number; y: number; w: number; h: number };

export type TextZoneKey =
  | "header"
  | "title"
  | "subtitle"
  | "body"
  | "verdict"
  | "cause"
  | "footer"
  | "rank";

export type TextZoneSpec = {
  key: TextZoneKey;
  rect: Rect;
  maxLines: number;
  fontFamily: string;
  fontWeight: number; // 400..900
  align: "left" | "center" | "right";
  baseline: "top" | "middle" | "bottom";
  padding: number;
  minFont: number;
  maxFont: number;
  lineHeight: number; // multiplier
  transform?: "uppercase" | "none";
};

export type PlacementInput = {
  canvasW: number;
  canvasH: number;
  zones: TextZoneSpec[];
  textByZone: Partial<Record<TextZoneKey, string>>;
};

export type PlacedLine = { text: string; x: number; y: number };

export type ZonePlacement = {
  zone: TextZoneKey;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  align: "left" | "center" | "right";
  lines: PlacedLine[];
};

export type PlacementResult = { placements: ZonePlacement[] };
