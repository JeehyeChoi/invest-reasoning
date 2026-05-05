import type { SecMetricKey } from "@/shared/sec/metrics";

export type BuildMetricSeriesEnrichedInput = {
  ticker: string;
  cik: string;
  metricKey?: SecMetricKey;
};

export type MetricSeriesEnrichmentRow = {
  cik: string;
  ticker: string | null;
  metric_key: SecMetricKey;
  source_tag: string | null;
  fact_type: string;
  unit: string;
  val: number;
  start: Date | null;
  end: Date;
  fiscal_year: number | null;
  fiscal_quarter: number | null;
  period_type: string;
  duration_days: number | null;
};

export type ComparablePeriodSourceKind =
  | "strict_fiscal_quarter"
  | "comparable_date_gap";

export type TtmWindowSourceKind =
  | "strict_fiscal_quarters"
  | "comparable_date_gap";

export type EnrichedMetricSeriesRow = MetricSeriesEnrichmentRow & {
  yoy: number | null;
  qoq: number | null;
  yoy_delta: number | null;
  ttm_val: number | null;
  ttm_yoy: number | null;
  ttm_delta: number | null;
  rolling4_avg: number | null;
  duration_adjusted_val: number | null;
  duration_adjusted_yoy: number | null;
  duration_adjusted_qoq: number | null;
  duration_adjusted_yoy_delta: number | null;
  duration_adjusted_ttm_val: number | null;
  duration_adjusted_ttm_yoy: number | null;
  duration_adjusted_ttm_delta: number | null;
  duration_adjusted_rolling4_avg: number | null;
  yoy_source_kind: ComparablePeriodSourceKind | null;
  yoy_base_period_end: Date | null;
  qoq_source_kind: ComparablePeriodSourceKind | null;
  qoq_base_period_end: Date | null;
  ttm_source_kind: TtmWindowSourceKind | null;
  ttm_window_start: Date | null;
  ttm_window_end: Date | null;
  ttm_yoy_source_kind: TtmWindowSourceKind | null;
  ttm_yoy_base_window_start: Date | null;
  ttm_yoy_base_window_end: Date | null;
  is_turnaround: boolean | null;
  is_deterioration: boolean | null;
  is_loss_narrowing: boolean | null;
};
