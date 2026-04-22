import type { RevenueGrowthMetrics } from "@/backend/schemas/factors/growth";
import { normalizeSeries } from "@/backend/services/factors/growth/fundamentals_based/revenue/normalizeSeries";

type RevenueGrowthConfig = {
  weights: {
    yoy: number;
    qoq: number;
    consistency: number;
    acceleration: number;
  };
};

type RevenuePoint = {
  end: string;
  filed: string | null;
  val: number;
  periodType?: string;
  frame?: string | null;
};

function safeGrowth(current: number, base: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(base) || base === 0) {
    return 0;
  }

  return (current - base) / Math.abs(base);
}

export function compute(
  series: RevenuePoint[],
  config: RevenueGrowthConfig,
): RevenueGrowthMetrics | null {
  const normalized = normalizeSeries(series);

  if (normalized.length < 5) {
    return null;
  }

  const latest = normalized[normalized.length - 1];
  const prev = normalized[normalized.length - 2];
  const prevYear = normalized[normalized.length - 5];

  const yoy = safeGrowth(latest.val, prevYear.val);
  const qoq = safeGrowth(latest.val, prev.val);

  const yoyList: number[] = [];

  for (let i = normalized.length - 1; i >= normalized.length - 4; i -= 1) {
    if (i - 4 < 0) continue;

    const current = normalized[i];
    const previousYearPoint = normalized[i - 4];

    yoyList.push(safeGrowth(current.val, previousYearPoint.val));
  }

  const positiveCount = yoyList.filter((value) => value > 0).length;
  const consistencyScore =
    yoyList.length > 0 ? positiveCount / yoyList.length : 0;

  const acceleration =
    yoyList.length >= 2 ? yoyList[yoyList.length - 1] - yoyList[0] : 0;

  const { weights } = config;

  const score =
    weights.yoy * yoy +
    weights.qoq * qoq +
    weights.consistency * consistencyScore +
    weights.acceleration * acceleration;

  return {
    yoy,
    qoq,
    consistency: consistencyScore,
    acceleration,
    score,
  };
}
