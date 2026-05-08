export type TickerFactorMetricClusterOverview = {
  availableRuns: TickerFactorMetricClusterOverviewRun[];
  latestRun: TickerFactorMetricClusterOverviewRun | null;
  profiles: TickerFactorMetricClusterOverviewProfile[];
  clusters: TickerFactorMetricClusterOverviewTicker[];
  unavailableReason?: string;
};

export type TickerFactorMetricClusterOverviewRun = {
  runId: string;
  factor: string;
  axis: string;
  comparisonSetType: string;
  comparisonSetKey: string;
  clusterMethod: string;
  normalizationMethod: string;
  vectorMode: string | null;
  vectorSourcePolicy: string | null;
  vectorEffectiveDate: string;
  computedAt: string;
  tickerCount: number;
  featureCount: number;
  clusterCount: number;
};

export type TickerFactorMetricClusterOverviewProfile = {
  clusterId: number;
  clusterLabel: string | null;
  clusterSize: number;
  featureCount: number;
  averageCoverageRatio: number;
  averageDistanceToCentroid: number | null;
  sectorStats: TickerClusterCategoryStat[];
  industryStats: TickerClusterCategoryStat[];
  distinguishingFeatures: TickerClusterFeatureSummary[];
};

export type TickerClusterCategoryStat = {
  name: string;
  count: number;
  share: number;
};

export type TickerClusterFeatureSummary = {
  factorKey?: string;
  axisKey?: string;
  metricKey: string;
  featureKey: string;
  value: number;
  direction: "high" | "low";
};

export type TickerFactorMetricClusterOverviewTicker = {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
  clusterId: number;
  clusterLabel: string | null;
  coverageRatio: number;
  distanceToCentroid: number | null;
};
