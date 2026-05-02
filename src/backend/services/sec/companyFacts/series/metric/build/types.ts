// src/backend/services/sec/companyFacts/series/metric/build/types.ts
import type {
  CompanyFiscalProfile,
  CompanyMetricSignProfile,
} from "@/backend/services/sec/companyFacts/series/fiscal/types";
import type { ResolvedPeriod } from "@/backend/services/sec/companyFacts/series/period/types";
import type { PeriodResolveContext } from "@/backend/services/sec/companyFacts/series/period/resolveContext";
import type { CompanyFactTagSeriesRow } from "@/backend/services/sec/companyFacts/series/tag/types";
import type {
  CanonicalMetricSeriesRow,
  MetricBuildSourceKind,
} from "@/backend/services/sec/companyFacts/series/metric/types";

export type MetricBuildContext = {
  ticker: string;
  cik: string;
  metricKey: string;
  fiscalProfile: CompanyFiscalProfile | null;
  metricSignProfiles: CompanyMetricSignProfile[];
  periodContext: PeriodResolveContext;
  classification: TickerClassificationContext | null;
};

export type TickerClassificationContext = {
  sector: string | null;
  industry: string | null;
};

export type MetricBuildSourceRow = CompanyFactTagSeriesRow & {
  priority?: number | null;
};

export type MetricBuildCandidate = MetricBuildSourceRow & {
  resolvedPeriod: ResolvedPeriod;
  buildSourceKind: MetricBuildSourceKind;
};

export type BuiltMetricSeriesRow = CanonicalMetricSeriesRow;

export type BuildFlowMetricSeriesInput = {
  context: MetricBuildContext;
  rows: MetricBuildSourceRow[];
};

export type BuildInstantMetricSeriesInput = {
  context: MetricBuildContext;
  rows: MetricBuildSourceRow[];
};
