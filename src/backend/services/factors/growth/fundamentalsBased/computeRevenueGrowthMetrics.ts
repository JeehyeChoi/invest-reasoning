import type { RevenueGrowthMetrics } from "@/shared/schemas/factors/growth";
import { getRevenueFacts } from "./getRevenueFacts";

type RevenueFactPoint = {
  end: string;
  val: number;
  form?: string;
  filed?: string;
  fy?: number;
  fp?: string;
};

function filterQuarterly(points: RevenueFactPoint[]): RevenueFactPoint[] {
  return points.filter((point) => point.form === "10-Q");
}

function sortByEndDateDesc(points: RevenueFactPoint[]): RevenueFactPoint[] {
  return [...points].sort((a, b) => {
    if (a.end < b.end) return 1;
    if (a.end > b.end) return -1;
    return 0;
  });
}

function dedupeByPeriod(points: RevenueFactPoint[]): RevenueFactPoint[] {
  const seen = new Set<string>();
  const result: RevenueFactPoint[] = [];

  for (const point of points) {
    const key = `${point.end}::${point.fp ?? ""}::${point.fy ?? ""}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(point);
  }

  return result;
}

function computeYoY(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) {
    return null;
  }

  return (current - previous) / previous;
}

function computeTtm(points: RevenueFactPoint[]): number | null {
  if (points.length < 4) {
    return null;
  }

  return points.slice(0, 4).reduce((sum, point) => sum + point.val, 0);
}

export async function computeRevenueGrowthMetrics(
  cik: string
): Promise<RevenueGrowthMetrics | null> {
  const revenueFacts = await getRevenueFacts(cik);

  const quarterly = dedupeByPeriod(sortByEndDateDesc(filterQuarterly(revenueFacts)));

  if (quarterly.length < 5) {
    return null;
  }

  const latestQuarterYoY = computeYoY(quarterly[0].val, quarterly[4].val);

  const previousQuarterYoY =
    quarterly.length >= 6 ? computeYoY(quarterly[1].val, quarterly[5].val) : null;

  let positiveYoYQuarterCount4Q = 0;
  let isYoYGrowthConsistent4Q = true;

  for (let i = 0; i < 4; i += 1) {
    const current = quarterly[i];
    const previous = quarterly[i + 4];

    if (!current || !previous) {
      isYoYGrowthConsistent4Q = false;
      continue;
    }

    const yoy = computeYoY(current.val, previous.val);

    if (yoy !== null && yoy > 0) {
      positiveYoYQuarterCount4Q += 1;
    } else {
      isYoYGrowthConsistent4Q = false;
    }
  }

  const currentTtm = computeTtm(quarterly);
  const previousTtm = computeTtm(quarterly.slice(4));

  const ttmYoY =
    currentTtm !== null && previousTtm !== null
      ? computeYoY(currentTtm, previousTtm)
      : null;

  return {
    latestQuarterYoY,
    previousQuarterYoY,
    positiveYoYQuarterCount4Q,
    isYoYGrowthConsistent4Q,
    ttmYoY,
  };
}
