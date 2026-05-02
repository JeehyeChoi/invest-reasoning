export type TickerFactorMetricClusterOverview = {
  latestRun: {
    runId: string;
    factor: string;
    axis: string;
    comparisonSetType: string;
    comparisonSetKey: string;
    clusterMethod: string;
    normalizationMethod: string;
    vectorEffectiveDate: string;
    computedAt: string;
    tickerCount: number;
    featureCount: number;
    clusterCount: number;
  } | null;
  profiles: TickerFactorMetricClusterOverviewProfile[];
  clusters: TickerFactorMetricClusterOverviewTicker[];
  unavailableReason?: string;
};

export type TickerFactorMetricClusterOverviewProfile = {
  clusterId: number;
  clusterLabel: string | null;
  clusterSize: number;
  featureCount: number;
  averageCoverageRatio: number;
  averageDistanceToCentroid: number | null;
  distinguishingFeatures: TickerClusterFeatureSummary[];
};

export type TickerClusterFeatureSummary = {
  featureKey: string;
  metricKey: string;
  signalKey: string;
  value: number;
  direction: "high" | "low";
};

export type TickerFactorMetricClusterOverviewTicker = {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  industry: string | null;
  clusterId: number;
  clusterLabel: string | null;
  coverageRatio: number;
  distanceToCentroid: number | null;
};
