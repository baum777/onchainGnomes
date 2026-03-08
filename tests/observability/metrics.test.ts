import { describe, it, expect, beforeEach } from "vitest";
import {
  incrementCounter,
  setGauge,
  observeHistogram,
  getCounter,
  getGauge,
  getSnapshot,
  resetMetrics,
} from "../../src/observability/metrics.js";
import { COUNTER_NAMES, GAUGE_NAMES, HISTOGRAM_NAMES } from "../../src/observability/metricTypes.js";

describe("observability metrics", () => {
  beforeEach(() => {
    resetMetrics();
  });

  describe("counters", () => {
    it("incrementCounter increases value", () => {
      incrementCounter(COUNTER_NAMES.MENTIONS_SEEN_TOTAL);
      incrementCounter(COUNTER_NAMES.MENTIONS_SEEN_TOTAL, 2);
      expect(getCounter(COUNTER_NAMES.MENTIONS_SEEN_TOTAL)).toBe(3);
    });

    it("getSnapshot includes all counter names with values", () => {
      incrementCounter(COUNTER_NAMES.PUBLISH_SUCCESS_TOTAL);
      const snap = getSnapshot();
      expect(snap.counters[COUNTER_NAMES.PUBLISH_SUCCESS_TOTAL]).toBe(1);
      expect(snap.counters[COUNTER_NAMES.MENTIONS_SEEN_TOTAL]).toBe(0);
    });
  });

  describe("gauges", () => {
    it("setGauge and getGauge", () => {
      setGauge(GAUGE_NAMES.AUDIT_BUFFER_SIZE, 5);
      expect(getGauge(GAUGE_NAMES.AUDIT_BUFFER_SIZE)).toBe(5);
      setGauge(GAUGE_NAMES.CURRENT_POLL_INTERVAL_MS, 60_000);
      expect(getGauge(GAUGE_NAMES.CURRENT_POLL_INTERVAL_MS)).toBe(60_000);
    });

    it("getSnapshot includes all gauge names", () => {
      setGauge(GAUGE_NAMES.LLM_BUDGET_USED, 10);
      const snap = getSnapshot();
      expect(snap.gauges[GAUGE_NAMES.LLM_BUDGET_USED]).toBe(10);
    });
  });

  describe("histograms", () => {
    it("observeHistogram stores samples", () => {
      observeHistogram(HISTOGRAM_NAMES.FETCH_DURATION_MS, 100);
      observeHistogram(HISTOGRAM_NAMES.FETCH_DURATION_MS, 200);
      const snap = getSnapshot();
      expect(snap.histograms[HISTOGRAM_NAMES.FETCH_DURATION_MS]).toEqual([100, 200]);
    });

    it("getSnapshot includes all histogram names", () => {
      const snap = getSnapshot();
      expect(Array.isArray(snap.histograms[HISTOGRAM_NAMES.PUBLISH_DURATION_MS])).toBe(true);
      expect(snap.histograms[HISTOGRAM_NAMES.PUBLISH_DURATION_MS]).toEqual([]);
    });
  });

  describe("resetMetrics", () => {
    it("clears all values", () => {
      incrementCounter(COUNTER_NAMES.MENTIONS_SEEN_TOTAL);
      setGauge(GAUGE_NAMES.AUDIT_BUFFER_SIZE, 1);
      observeHistogram(HISTOGRAM_NAMES.FETCH_DURATION_MS, 1);
      resetMetrics();
      expect(getCounter(COUNTER_NAMES.MENTIONS_SEEN_TOTAL)).toBe(0);
      expect(getGauge(GAUGE_NAMES.AUDIT_BUFFER_SIZE)).toBe(0);
      expect(getSnapshot().histograms[HISTOGRAM_NAMES.FETCH_DURATION_MS]).toEqual([]);
    });
  });
});
