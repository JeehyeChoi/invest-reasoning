import type { FactorKey, FactorScoreAxisKey } from "@/backend/schemas/factor";
import type { SecMetricKey } from "@/backend/schemas/sec/metrics";
import type { FactorModelFamily } from "@/backend/config/factors/active";

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

export type TickerOverviewFactorMetric = {
  factor: FactorKey;
  axis: FactorScoreAxisKey;
  metricKey: SecMetricKey;
  model: FactorModelFamily;
  effectiveDate: string | null;
  score: number | null;
  metrics: Record<string, unknown> | null;
  interpretation: string | null;
  display: TickerOverviewMetricDisplay | null;
};

export type TickerOverview = {
  ticker: string;
  company: TickerOverviewCompany | null;
  factorMetrics: TickerOverviewFactorMetric[];
};


