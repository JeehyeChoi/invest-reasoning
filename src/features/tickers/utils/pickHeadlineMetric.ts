import type { TickerOverviewFactorMetric } from "@/shared/tickers/tickerOverview";

export function pickHeadlineMetric(
  factorMetrics: TickerOverviewFactorMetric[],
): TickerOverviewFactorMetric | null {
  const candidates = factorMetrics.filter(
    (metric) =>
      metric.display !== null &&
      metric.headline?.primarySignalValue !== null &&
      metric.headline?.primarySignalValue !== undefined,
  );

  if (candidates.length === 0) {
    return factorMetrics[0] ?? null;
  }

  return [...candidates].sort((a, b) => {
    const aScore = resolveHeadlineRankValue(a);
    const bScore = resolveHeadlineRankValue(b);

    if (aScore !== bScore) {
      return bScore - aScore;
    }

    const aQuality = resolveDataQualityRank(a.headline?.dataQualityLevel);
    const bQuality = resolveDataQualityRank(b.headline?.dataQualityLevel);

    if (aQuality !== bQuality) {
      return bQuality - aQuality;
    }

    const aValue = a.headline?.primarySignalValue ?? Number.NEGATIVE_INFINITY;
    const bValue = b.headline?.primarySignalValue ?? Number.NEGATIVE_INFINITY;

    return bValue - aValue;
  })[0];
}

function resolveHeadlineRankValue(metric: TickerOverviewFactorMetric): number {
  const usaPosition = metric.positions?.find(
    (position) => position.comparisonSetType === "us_public_equities",
  );

  return usaPosition?.percentile ?? Number.NEGATIVE_INFINITY;
}

function resolveDataQualityRank(value?: string | null): number {
  switch (value) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}
