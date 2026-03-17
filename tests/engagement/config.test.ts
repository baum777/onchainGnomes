import { describe, expect, it } from "vitest";
import { readTimelineEngagementConfig } from "../../src/config/timelineEngagementConfig.js";

describe("timeline engagement config", () => {
  it("uses conservative defaults", () => {
    delete process.env.TIMELINE_ENGAGEMENT_ENABLED;
    delete process.env.TIMELINE_ENGAGEMENT_MAX_PER_RUN;
    delete process.env.TIMELINE_SOURCE_ACCOUNTS;

    const cfg = readTimelineEngagementConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.maxPerRun).toBe(2);
    expect(cfg.sourceAccounts).toEqual([]);
  });

  it("caps max-per-run at 3", () => {
    process.env.TIMELINE_ENGAGEMENT_MAX_PER_RUN = "10";
    const cfg = readTimelineEngagementConfig();
    expect(cfg.maxPerRun).toBe(3);
  });
});
