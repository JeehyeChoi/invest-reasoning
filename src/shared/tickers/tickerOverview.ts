import type { FactorKey, FactorScoreAxisKey } from "@/shared/factors/factors";
import type { SecMetricKey } from "@/shared/sec/metrics";
import type { FactorScoringMethod } from "@/shared/factors/methods";

export type TickerOverviewCompany = {
  ticker: string;
  companyName: string | null;
  description: string | null;
  website: string | null;
  ceo: string | null;
  ipoDate: string | null;
  fullTimeEmployees: number | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  sector: string | null;
  industry: string | null;
  marketCap: number | null;
	fiscalProfile?: {
		latestFiscalYear: number | null;
		latestAnnualStart: string | null;
		latestAnnualEnd: string | null;
		fiscalYearEndMonth: number | null;
		fiscalYearEndDay: number | null;
	} | null;
};

export type TickerOverviewMetricDisplay = {
  headlineTitle: string;
  chart: {
    type: string;
    metricKey: string;
    title: string;
  } | null;
  metricOrder: string[];
  metricLabels: Record<string, string>;
  formula: {
    type: string;
    show: boolean;
	  text?: string | null;
  } | null;
};

export type TickerOverviewSignalPosition = {
  comparisonSetType: string;
  comparisonSetKey: string;
  effectiveDate: string | null;
  signalKey: string;
  signalValue: number | null;
  percentile: number | null;
  zScore: number | null;
  distanceToMedian: number | null;
  quartile: number | null;
  decile: number | null;
  universeCount: number | null;
};

export type TickerOverviewSignalHeadline = {
  headlinePeriodEnd: string | null;
  headlineEffectiveDate: string | null;
  interpretationLabel: string | null;
  interpretationSummary: string | null;
  latestGrowthValue: number | null;
  latestGrowthMethod: string | null;
  durableGrowthValue: number | null;
  durableGrowthMethod: string | null;
  consistencyValue: number | null;
  consistencyMethod: string | null;
  coverageValue: number | null;
  coverageMethod: string | null;
  accelerationValue: number | null;
  accelerationMethod: string | null;
  trendDeviationValue: number | null;
  trendDeviationMethod: string | null;
  primarySignalKey: string | null;
  primarySignalValue: number | null;
  primarySignalMethod: string | null;
  dataQualityLevel: string | null;
};

export type TickerOverviewFactorMetric = {
  factor: FactorKey;
  axis: FactorScoreAxisKey;
  metricKey: SecMetricKey;
  method: FactorScoringMethod | "signal_headline";
  effectiveDate: string | null;
  score: number | null;
  metrics: Record<string, unknown> | null;
  interpretation: string | null;
  display: TickerOverviewMetricDisplay | null;
  headline?: TickerOverviewSignalHeadline | null;
  positions?: TickerOverviewSignalPosition[];
};

export type TickerOverview = {
  ticker: string;
  company: TickerOverviewCompany | null;
  factorMetrics: TickerOverviewFactorMetric[];
};
