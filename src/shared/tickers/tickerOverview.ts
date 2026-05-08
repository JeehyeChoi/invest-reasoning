import type { FactorKey, FactorMetricRole } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { SecMetricKey } from "@/shared/sec/metrics";

export type TickerOverviewCompany = {
  ticker: string;
  cik: string | null;
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
  exchange: string | null;
  exchangeFullName: string | null;
  currency: string | null;
  isEtf: boolean | null;
  isFund: boolean | null;
  isAdr: boolean | null;
  isActivelyTrading: boolean | null;
  price: number | null;
  marketCap: number | null;
  volume: number | null;
  averageVolume: number | null;
  fiftyTwoWeekRange: string | null;
  priceChange: number | null;
  priceChangePercentage: number | null;
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

export type TickerOverviewFactorMetricFeature = {
  featureKey: string;
  featureLabel: string;
  featureValue: number | null;
  periodEnd: string | null;
  effectiveDate: string | null;
};

export type TickerOverviewSignalEvidence = {
  metricKey: string;
  featureKey: string;
  featureValue: number;
  periodEnd: string;
  effectiveDate: string;
};

export type TickerOverviewFactorInsight = {
  modelKey: string | null;
  modelVersion: string | null;
  signalMethod: string | null;
  signalPeriodEnd: string | null;
  signalEffectiveDate: string | null;
  signalKey: string | null;
  signalLabel: string | null;
  signalValue: number | null;
  signalConfidence: number | null;
  primaryMetricKey: string | null;
  primaryFeatureKey: string | null;
  primaryFeatureValue: number | null;
  observedMetricCount: number | null;
  totalMetricCount: number | null;
  featureValues: Record<
    string,
    { value: number; observedMetricCount: number }
  >;
  candidateCount: number;
  selectedPriority: number | null;
  candidates: TickerOverviewFactorSignalCandidate[];
  supportingEvidence: TickerOverviewSignalEvidence[];
  contradictingEvidence: TickerOverviewSignalEvidence[];
};

export type TickerOverviewFactorSignalCandidate = {
  signalKey: string;
  signalLabel: string;
  signalDescription: string | null;
  priority: number | null;
  selectionRulesSummary: string;
  selectionRules: unknown;
};

export type TickerOverviewFactorSignal = TickerOverviewFactorInsight & {
  factor: FactorKey;
  axis: FactorAxisKey;
};

export type TickerOverviewFactorMetric = {
  factor: FactorKey;
  axis: FactorAxisKey;
  metricKey: SecMetricKey;
  metricRole: FactorMetricRole;
  effectiveDate: string | null;
  display: TickerOverviewMetricDisplay | null;
  features?: TickerOverviewFactorMetricFeature[];
  missingFeatureMessage?: string | null;
  factorInsight?: TickerOverviewFactorInsight | null;
};

export type TickerOverview = {
  ticker: string;
  company: TickerOverviewCompany | null;
  factorSignals: TickerOverviewFactorSignal[];
  factorMetrics: TickerOverviewFactorMetric[];
};

export type TickerSignalDetail = {
  ticker: string;
  factor: FactorKey;
  axis: FactorAxisKey;
  signal: TickerOverviewFactorSignal | null;
};
