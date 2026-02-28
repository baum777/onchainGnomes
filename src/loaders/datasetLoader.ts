import { readFileSync } from "fs";
import { resolve } from "path";

export type DatasetBank = {
  captions: string[];
  roastReplies: string[];
  exampleTweets: string[];
};

const DATASET_PATHS: Record<keyof DatasetBank, string> = {
  captions: "prompts/datasets/captions.txt",
  roastReplies: "prompts/datasets/roast_replies.txt",
  exampleTweets: "prompts/datasets/example_tweets.txt",
};

function loadTxt(path: string): string[] {
  const fullPath = resolve(path);
  const content = readFileSync(fullPath, "utf-8");
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

export function loadDatasetBank(rootDir = "."): DatasetBank {
  const load = (key: keyof DatasetBank) => {
    try {
      return loadTxt(resolve(rootDir, DATASET_PATHS[key]));
    } catch {
      return [];
    }
  };

  return {
    captions: load("captions"),
    roastReplies: load("roastReplies"),
    exampleTweets: load("exampleTweets"),
  };
}
