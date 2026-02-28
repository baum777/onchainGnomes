import { DatasetBank } from "./datasetLoader.js";
import { pickOne, RNG } from "../memes/dice.js";
import { createSeededRNG } from "./seed.js";

export type CaptionContext = {
  userHandle?: string;
  tone?: "mocking" | "celebratory" | "neutral";
};

export function pickCaption(
  bank: DatasetBank,
  seedKey: string,
  _ctx?: CaptionContext
): string {
  if (!bank.captions || bank.captions.length === 0) {
    return "certified market trauma survivor";
  }

  const rng: RNG = createSeededRNG(seedKey);
  return pickOne(bank.captions, rng);
}

export function pickRoastReply(
  bank: DatasetBank,
  seedKey: string
): string {
  if (!bank.roastReplies || bank.roastReplies.length === 0) {
    return "reply early, cope later";
  }

  const rng: RNG = createSeededRNG(seedKey);
  return pickOne(bank.roastReplies, rng);
}
