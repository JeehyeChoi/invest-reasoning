// src/backend/services/factors/growth/fundamentals_based/computeSeriesGrowth.ts

import type {
  GrowthMetricSignals,
  GrowthMetricSignalsExtended,
} from "@/backend/schemas/factors/growth";
import { normalizeSeries } from "@/backend/services/factors/growth/fundamentals_based/normalizeSeries";

export type SeriesGrowthMode = "basic" | "extended";

export type SeriesGrowthConfig = {
  compute?: {
    mode?: SeriesGrowthMode;
  };
  weights: {
    yoy: number;
    qoq: number;
    consistency: number;
    acceleration: number;
    turnaround?: number;
    deterioration?: number;
    lossNarrowing?: number;
  };
};

export type SeriesPoint = {
  end: string;
  filed: string | null;
  val: number;
  periodType?: string;
  frame?: string | null;
};

function calcGrowth(current: number, base: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(base) || base === 0) {
    return 0;
  }

  return (current - base) / Math.abs(base);
}

function detectTurnaround(current: number, base: number): boolean {
  return base < 0 && current > 0;
}

function detectDeterioration(current: number, base: number): boolean {
  return base > 0 && current < 0;
}

function detectLossNarrowing(current: number, base: number): boolean {
  return base < 0 && current < 0 && current > base;
}

export function computeSeriesGrowth(
  series: SeriesPoint[],
  config: SeriesGrowthConfig,
  mode: "basic",
): GrowthMetricSignals | null;

export function computeSeriesGrowth(
  series: SeriesPoint[],
  config: SeriesGrowthConfig,
  mode: "extended",
): GrowthMetricSignalsExtended | null;

export function computeSeriesGrowth(
  series: SeriesPoint[],
  config: SeriesGrowthConfig,
  mode: SeriesGrowthMode,
): GrowthMetricSignals | GrowthMetricSignalsExtended | null;

export function computeSeriesGrowth(
  series: SeriesPoint[],
  config: SeriesGrowthConfig,
  mode: SeriesGrowthMode = "basic",
): GrowthMetricSignals | GrowthMetricSignalsExtended | null {
  const normalized = normalizeSeries(series);

  if (normalized.length < 5) return null;

  const latest = normalized[normalized.length - 1];
  const prev = normalized[normalized.length - 2];
  const prevYear = normalized[normalized.length - 5];

  const yoy = calcGrowth(latest.val, prevYear.val);
  const qoq = calcGrowth(latest.val, prev.val);

  const yoySeries: number[] = [];

  for (let i = normalized.length - 1; i >= normalized.length - 4; i -= 1) {
    if (i - 4 < 0) continue;
    yoySeries.push(calcGrowth(normalized[i].val, normalized[i - 4].val));
  }

  const positiveCount = yoySeries.filter((v) => v > 0).length;
  const consistency =
    yoySeries.length > 0 ? positiveCount / yoySeries.length : 0;

  const acceleration =
    yoySeries.length >= 2
      ? yoySeries[yoySeries.length - 1] - yoySeries[0]
      : 0;

  const { weights } = config;

  const baseScore =
    weights.yoy * yoy +
    weights.qoq * qoq +
    weights.consistency * consistency +
    weights.acceleration * acceleration;

  if (mode === "basic") {
    return {
      yoy,
      qoq,
      consistency,
      acceleration,
      score: baseScore,
    };
  }

  const turnaround = detectTurnaround(latest.val, prevYear.val);
  const deterioration = detectDeterioration(latest.val, prevYear.val);
  const lossNarrowing = detectLossNarrowing(latest.val, prevYear.val);
  const profitabilityState = latest.val >= 0 ? "profit" : "loss";

  const extendedScore =
    baseScore +
    (weights.turnaround ?? 0) * (turnaround ? 1 : 0) +
    (weights.deterioration ?? 0) * (deterioration ? -1 : 0) +
    (weights.lossNarrowing ?? 0) * (lossNarrowing ? 1 : 0);

  return {
    yoy,
    qoq,
    consistency,
    acceleration,
    score: extendedScore,
    turnaround,
    deterioration,
    profitabilityState,
    lossNarrowing,
  };
}
