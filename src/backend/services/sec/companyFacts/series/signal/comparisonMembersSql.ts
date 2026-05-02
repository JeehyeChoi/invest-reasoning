import type { FactorKey, FactorScoreAxisKey } from "@/shared/factors/factors";
import type { SecMetricKey } from "@/shared/sec/metrics";

export type BuildComparisonInput = {
  factor?: FactorKey;
  axis?: FactorScoreAxisKey;
  metricKey?: SecMetricKey;
  asOfDate?: string;
};

export type ResolvedBuildComparisonInput = Required<
  Pick<BuildComparisonInput, "factor" | "axis">
> &
  BuildComparisonInput;

export const LATEST_COMPARISON_MEMBERS_CTE = `
WITH latest_signals AS (
  SELECT DISTINCT ON (
    s.ticker,
    s.factor,
    s.axis,
    s.metric_key,
    s.signal_key
  )
    s.ticker,
    s.factor,
    s.axis,
    s.metric_key,
    s.signal_key,
    s.signal_value,
    COALESCE($4::date, current_date) AS comparison_effective_date
  FROM public.ticker_factor_metric_signals s
  WHERE s.factor = $1
    AND s.axis = $2
    AND ($3::text IS NULL OR s.metric_key = $3)
    AND ($4::date IS NULL OR s.effective_date <= $4)
    AND s.signal_value IS NOT NULL
  ORDER BY
    s.ticker,
    s.factor,
    s.axis,
    s.metric_key,
    s.signal_key,
    s.effective_date DESC,
    s.period_end DESC NULLS LAST
),
base_signals AS (
  SELECT
    s.ticker,
    s.factor,
    s.axis,
    s.metric_key,
    s.signal_key,
    s.signal_value,
    s.comparison_effective_date,
    c.sector,
    c.industry
  FROM latest_signals s
  LEFT JOIN public.ticker_company_classifications c
    ON c.ticker = s.ticker
),
comparison_members AS (
  SELECT
    ticker,
    factor,
    axis,
    metric_key,
    signal_key,
    signal_value,
    comparison_effective_date,
    'us_public_equities'::text AS comparison_set_type,
    'all'::text AS comparison_set_key
  FROM base_signals

  UNION ALL

  SELECT
    ticker,
    factor,
    axis,
    metric_key,
    signal_key,
    signal_value,
    comparison_effective_date,
    'sp500'::text AS comparison_set_type,
    'all'::text AS comparison_set_key
  FROM base_signals

  UNION ALL

  SELECT
    ticker,
    factor,
    axis,
    metric_key,
    signal_key,
    signal_value,
    comparison_effective_date,
    'sector'::text AS comparison_set_type,
    sector AS comparison_set_key
  FROM base_signals
  WHERE sector IS NOT NULL AND sector <> ''

  UNION ALL

  SELECT
    ticker,
    factor,
    axis,
    metric_key,
    signal_key,
    signal_value,
    comparison_effective_date,
    'industry'::text AS comparison_set_type,
    industry AS comparison_set_key
  FROM base_signals
  WHERE industry IS NOT NULL AND industry <> ''
)
`;

export function resolveBuildComparisonInput(
  input: BuildComparisonInput = {},
): ResolvedBuildComparisonInput {
  return {
    ...input,
    factor: input.factor ?? "growth",
    axis: input.axis ?? "fundamentals_based",
  };
}

export function buildComparisonQueryParams(
  input: ResolvedBuildComparisonInput,
): unknown[] {
  return [
    input.factor,
    input.axis,
    input.metricKey ?? null,
    input.asOfDate ?? null,
  ];
}
