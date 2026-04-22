import type { TickerOverviewFactorMetric } from "@/backend/schemas/tickers/tickerOverview";

export function pickHeadlineMetric(
  factorMetrics: TickerOverviewFactorMetric[],
): TickerOverviewFactorMetric | null {
  const candidates = factorMetrics.filter(
    (metric) => metric.display !== null && metric.score !== null,
  );

  if (candidates.length === 0) {
    return factorMetrics[0] ?? null;
  }

  return [...candidates].sort((a, b) => {
    const aScore = a.score ?? Number.NEGATIVE_INFINITY;
    const bScore = b.score ?? Number.NEGATIVE_INFINITY;
    return bScore - aScore;
  })[0];
}
