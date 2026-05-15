import type { FactorKey } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { SecMetricKey } from "@/shared/sec/metrics";
import type { MarketPriceMetricKey } from "@/shared/factors/marketPriceMetrics";
import type { ValuationMetricKey } from "@/shared/factors/valuationMetrics";
import type { MacroLinkedMetricKey } from "@/shared/factors/macroLinkedMetrics";

export type MetricFeatureMetricKey =
  | SecMetricKey
  | MarketPriceMetricKey
  | ValuationMetricKey
  | MacroLinkedMetricKey;

export type MetricFeatureMethod =
  | "direct"
  | "negative_direct"
  | "positive_ratio"
  | "negative_ratio"
  | "valid_ratio"
  | "ratio_to_denominator"
  | "spread_to_denominator"
  | "ratio_deviation"
  | "lag_ratio_deviation"
  | "relative_deviation"
  | "negative_relative_deviation"
  | "turnaround_momentum"
  | "macro_sensitivity_beta";

export type MetricFeatureValueType = "ratio" | "value";

export type MetricFeatureSignProfileAction = "use" | "invert" | "null";

export type MetricFeatureSignProfilePolicy = {
  negativeDominant: MetricFeatureSignProfileAction;
  positiveDominant?: MetricFeatureSignProfileAction;
  mixed?: MetricFeatureSignProfileAction;
  unknown?: MetricFeatureSignProfileAction;
  zeroOrSparse?: MetricFeatureSignProfileAction;
  minConfidence?: number;
};

export type MetricFeatureSeriesPeriodType = "quarter" | "instant" | "snapshot";

export type MetricFeatureSourceKey =
  | "metric_value"
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

export type MetricFeatureDefinition = {
  source?: MetricFeatureSourceKey;
  series?: MetricFeatureSeriesSource;
  sources?: {
    turnaround?: MetricFeatureSourceKey;
    lossNarrowing?: MetricFeatureSourceKey;
    deterioration?: MetricFeatureSourceKey;
  };
  reference?: MetricFeatureSourceKey;
  denominator?: MetricFeatureSeriesSource & {
    source: MetricFeatureSourceKey;
  };
  counterpart?: MetricFeatureSeriesSource & {
    source: MetricFeatureSourceKey;
  };
  lookback?: number;
  minObservations?: number;
  method?: MetricFeatureMethod;
  macroSource?: {
    provider: "fred";
    seriesKey?: string;
    seriesId: string;
    units: string;
    valueScale?: number;
  };
  signProfilePolicy?: MetricFeatureSignProfilePolicy;
  valueType?: MetricFeatureValueType;
  comparison?: boolean;
  macroContrast?: boolean;
  clustering?: boolean;
};

export type MetricFeatureSeriesSource = {
  table:
    | "sec_companyfact_metric_series_enriched"
    | "ticker_derived_metric_series";
  version: string;
  processKey: string;
  metricKey?: MetricFeatureMetricKey | string;
  periodType: MetricFeatureSeriesPeriodType;
};

export type MetricFeatureInterpretationConfig = {
  version: string;
  factor: FactorKey;
  axis: FactorAxisKey;
  metricKey: MetricFeatureMetricKey;
  features: Record<string, MetricFeatureDefinition>;
};

export type EnrichedMetricSeriesSignalRow = {
  ticker: string | null;
  cik: string;
  metric_key: MetricFeatureMetricKey | string;
  source_tag: string | null;
  unit: string;
  metric_value?: number | null;
  val: number | null;
  end: Date | string;
  effective_date?: Date | string | null;
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

export type TickerFactorMetricFeatureRow = {
  ticker: string;
  cik: string | null;
  factor: FactorKey;
  axis: FactorAxisKey;
  metric_key: MetricFeatureMetricKey;
  feature_key: string;
  feature_value: number | null;
  period_end: string;
  effective_date: string;
  source_table: string;
  source_version: string;
};
