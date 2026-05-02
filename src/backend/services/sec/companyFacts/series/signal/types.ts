import type { FactorKey, FactorScoreAxisKey } from "@/shared/factors/factors";
import type { SecMetricKey } from "@/shared/sec/metrics";

export type MetricSignalMethod =
  | "direct"
  | "positive_ratio"
  | "valid_ratio"
  | "relative_deviation"
  | "profitability_shift";

export type MetricSignalSourceKey =
  | "val"
  | "yoy"
  | "qoq"
  | "yoy_delta"
  | "ttm_val"
  | "ttm_yoy"
  | "ttm_delta"
  | "rolling4_avg"
  | "duration_adjusted_val"
  | "duration_adjusted_yoy"
  | "duration_adjusted_qoq"
  | "duration_adjusted_yoy_delta"
  | "duration_adjusted_ttm_val"
  | "duration_adjusted_ttm_yoy"
  | "duration_adjusted_ttm_delta"
  | "duration_adjusted_rolling4_avg"
  | "is_turnaround"
  | "is_deterioration"
  | "is_loss_narrowing";

export type MetricSignalDefinition = {
  enabled?: boolean;
  source?: MetricSignalSourceKey;
  sources?: {
    turnaround?: MetricSignalSourceKey;
    lossNarrowing?: MetricSignalSourceKey;
    deterioration?: MetricSignalSourceKey;
  };
  reference?: MetricSignalSourceKey;
  lookback?: number;
  method?: MetricSignalMethod;
};

export type MetricSignalInterpretationConfig = {
  version: string;
  factor: FactorKey;
  axis: FactorScoreAxisKey;
  metricKey: SecMetricKey;
  source: {
    table: "sec_companyfact_metric_series_enriched";
    version: string;
    periodType: string;
  };
  signals: Record<string, MetricSignalDefinition>;
};

export type EnrichedMetricSeriesSignalRow = {
  ticker: string | null;
  cik: string;
  metric_key: SecMetricKey;
  val: number | null;
  end: Date | string;
  period_type: string;
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
  is_turnaround: boolean | null;
  is_deterioration: boolean | null;
  is_loss_narrowing: boolean | null;
};

export type TickerFactorMetricSignalRow = {
  ticker: string;
  cik: string | null;
  factor: FactorKey;
  axis: FactorScoreAxisKey;
  metric_key: SecMetricKey;
  signal_key: string;
  signal_value: number | null;
  period_end: string;
  effective_date: string;
  source_table: string;
  source_version: string;
};
