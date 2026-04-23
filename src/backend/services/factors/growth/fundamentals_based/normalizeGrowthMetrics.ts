import type { GrowthMetricSignalsExtended } from "@/backend/schemas/factors/growth";

function toNullableNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toNullableBoolean(value: unknown): boolean | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return null;
}

export function normalizeGrowthMetrics(
  metrics: Record<string, unknown> | null,
): GrowthMetricSignalsExtended | null {
  if (!metrics) {
    return null;
  }

  return {
    yoy: toNullableNumber(metrics.yoy),
    qoq: toNullableNumber(metrics.qoq),
    consistency: toNullableNumber(metrics.consistency),
    acceleration: toNullableNumber(metrics.acceleration),
    score: toNullableNumber(metrics.score),
    turnaround: toNullableBoolean(metrics.turnaround),
    deterioration: toNullableBoolean(metrics.deterioration),
    profitabilityState:
      metrics.profitabilityState === "profit" ||
      metrics.profitabilityState === "loss"
        ? metrics.profitabilityState
        : null,
    lossNarrowing: toNullableBoolean(metrics.lossNarrowing),
  };
}
