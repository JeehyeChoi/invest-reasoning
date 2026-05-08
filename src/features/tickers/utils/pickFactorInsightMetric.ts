import type { TickerOverviewFactorMetric } from "@/shared/tickers/tickerOverview";

export function pickFactorInsightMetric(
  factorMetrics: TickerOverviewFactorMetric[],
): TickerOverviewFactorMetric | null {
  const candidates = factorMetrics.filter(
    (metric) =>
      metric.display !== null &&
      metric.factorInsight?.signalValue !== null &&
      metric.factorInsight?.signalValue !== undefined,
  );

  if (candidates.length === 0) {
    return factorMetrics[0] ?? null;
  }

  return [...candidates].sort((a, b) => {
    const aScore = resolveFactorInsightRankValue(a);
    const bScore = resolveFactorInsightRankValue(b);

    if (aScore !== bScore) {
      return bScore - aScore;
    }

    const aValue =
      a.factorInsight?.signalConfidence ?? Number.NEGATIVE_INFINITY;
    const bValue =
      b.factorInsight?.signalConfidence ?? Number.NEGATIVE_INFINITY;

    return bValue - aValue;
  })[0];
}

function resolveFactorInsightRankValue(
  metric: TickerOverviewFactorMetric,
): number {
  return metric.factorInsight?.signalConfidence ?? Number.NEGATIVE_INFINITY;
}
