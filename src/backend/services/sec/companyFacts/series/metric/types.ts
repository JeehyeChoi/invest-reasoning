import type { CompanyFactType } from "@/backend/services/sec/companyFacts/series/types";
import type {
  FiscalQuarter,
  PeriodKind,
} from "@/backend/services/sec/companyFacts/series/period/types";

export type CompanyFactPeriodType = PeriodKind;
export type MetricBuildSourceKind =
  | "raw_direct"
  | "raw_partial"
  | "segment_merged"
  | "other_merged"
  | "cumulative_derived"
  | "annual_derived";

export type CompanyFactPeriodSubtype =
  | "normal"
  | "short_transition"
  | "long_53_week";

export type CanonicalMetricSeriesRow = {
  cik: string;
  ticker: string | null;

  metric_key: string;
  source_tag: string | null;
  fact_type: CompanyFactType;
  unit: string;
  val: number;

  start: string | Date | null;
  end: string | Date;
  duration_days: number | null;

  filed: string | Date | null;
  effective_date: string | Date;
  accn: string | null;
  fy: number | null;
  fp: string | null;
  form: string | null;
  frame: string | null;

  fiscal_year: number | null;
  fiscal_quarter: FiscalQuarter | null;

  period_type: CompanyFactPeriodType;
  build_source_kind: MetricBuildSourceKind | null;
  workflow_type: string | null;
};

export type BuildCanonicalSeriesInput = {
  ticker: string | null;
  metricKey?: string | null;
  factType: CompanyFactType;
};
