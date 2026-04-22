import type { RevenueGrowthMetrics } from "@/backend/schemas/factors/growth";

function toNullableNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalize(
  metrics: Record<string, unknown> | null,
): RevenueGrowthMetrics | null {
  if (!metrics) {
    return null;
  }

  return {
    yoy: toNullableNumber(metrics.yoy),
    qoq: toNullableNumber(metrics.qoq),
    consistency: toNullableNumber(metrics.consistency),
    acceleration: toNullableNumber(metrics.acceleration),
    score: toNullableNumber(metrics.score),
  };
}
