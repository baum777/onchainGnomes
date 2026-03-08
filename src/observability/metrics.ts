/**
 * Phase 4 — In-process metrics registry.
 * Counters, gauges, and histograms for observability.
 */

import {
  COUNTER_NAMES,
  GAUGE_NAMES,
  HISTOGRAM_NAMES,
  type CounterName,
  type GaugeName,
  type HistogramName,
  type MetricsSnapshot,
} from "./metricTypes.js";

const counters: Record<string, number> = {};
const gauges: Record<string, number> = {};
const histograms: Record<string, number[]> = {};
const HISTOGRAM_MAX_SAMPLES = 1000;

function ensureCounter(name: string): number {
  if (counters[name] === undefined) counters[name] = 0;
  return counters[name]!;
}

function ensureGauge(name: string): number {
  if (gauges[name] === undefined) gauges[name] = 0;
  return gauges[name]!;
}

function ensureHistogram(name: string): number[] {
  if (!histograms[name]) histograms[name] = [];
  return histograms[name]!;
}

export function incrementCounter(name: CounterName, value: number = 1): void {
  ensureCounter(name);
  counters[name]! += value;
}

export function setGauge(name: GaugeName, value: number): void {
  gauges[name] = value;
}

export function observeHistogram(name: HistogramName, value: number): void {
  const arr = ensureHistogram(name);
  arr.push(value);
  if (arr.length > HISTOGRAM_MAX_SAMPLES) arr.shift();
}

export function recordDuration(histogramName: HistogramName, startMs: number): void {
  observeHistogram(histogramName, Math.round(Date.now() - startMs));
}

export function getCounter(name: CounterName): number {
  return ensureCounter(name);
}

export function getGauge(name: GaugeName): number {
  return ensureGauge(name);
}

export function getHistogramSamples(name: HistogramName): number[] {
  return [...ensureHistogram(name)];
}

export function getSnapshot(): MetricsSnapshot {
  const counterNames = Object.values(COUNTER_NAMES);
  const gaugeNames = Object.values(GAUGE_NAMES);
  const histogramNames = Object.values(HISTOGRAM_NAMES);
  return {
    counters: Object.fromEntries(counterNames.map((n) => [n, ensureCounter(n)])),
    gauges: Object.fromEntries(gaugeNames.map((n) => [n, ensureGauge(n)])),
    histograms: Object.fromEntries(histogramNames.map((n) => [n, [...ensureHistogram(n)]])),
  };
}

export function resetMetrics(): void {
  for (const k of Object.keys(counters)) delete counters[k];
  for (const k of Object.keys(gauges)) delete gauges[k];
  for (const k of Object.keys(histograms)) delete histograms[k];
}

// ——— Convenience API for instrumentation ———

export const metrics = {
  incrementCounter,
  setGauge,
  observeHistogram,
  recordDuration,
  getCounter,
  getGauge,
  getSnapshot,
  resetMetrics,
};

export {
  COUNTER_NAMES,
  GAUGE_NAMES,
  HISTOGRAM_NAMES,
};
