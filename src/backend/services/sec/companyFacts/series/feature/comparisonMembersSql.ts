import type { FactorKey } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { MetricFeatureMetricKey } from "@/backend/services/sec/companyFacts/series/feature/types";

export type BuildComparisonInput = {
  factor?: FactorKey;
  axis?: FactorAxisKey;
  metricKey?: MetricFeatureMetricKey;
  asOfDate?: string;
};

export type ResolvedBuildComparisonInput = Required<
  Pick<BuildComparisonInput, "factor" | "axis">
> &
  BuildComparisonInput;

export const LATEST_COMPARISON_MEMBERS_CTE_BODY = `
latest_features AS (
  SELECT DISTINCT ON (
    COALESCE(s.cik, s.ticker),
    s.factor,
    s.axis,
    s.metric_key,
    s.feature_key
  )
    s.ticker,
    s.cik,
    s.factor,
    s.axis,
    s.metric_key,
    s.feature_key,
    s.feature_value,
    COALESCE($4::date, current_date) AS comparison_effective_date
  FROM public.ticker_factor_metric_features s
  WHERE s.factor = $1
    AND s.axis = $2
    AND ($3::text IS NULL OR s.metric_key = $3)
    AND ($4::date IS NULL OR s.effective_date <= $4)
    AND s.feature_value IS NOT NULL
  ORDER BY
    COALESCE(s.cik, s.ticker),
    s.factor,
    s.axis,
    s.metric_key,
    s.feature_key,
    s.effective_date DESC,
    s.period_end DESC NULLS LAST,
    s.ticker ASC
),
base_features AS (
  SELECT
    s.ticker,
    s.cik,
    s.factor,
    s.axis,
    s.metric_key,
    s.feature_key,
    s.feature_value,
    s.comparison_effective_date,
    c.sector,
    c.industry
  FROM latest_features s
  LEFT JOIN public.ticker_company_classifications c
    ON c.ticker = s.ticker
),
comparison_members AS (
  SELECT
    ticker,
    cik,
    factor,
    axis,
    metric_key,
    feature_key,
    feature_value,
    comparison_effective_date,
    'us_public_equities'::text AS comparison_set_type,
    'all'::text AS comparison_set_key
  FROM base_features

  UNION ALL

  SELECT
    ticker,
    cik,
    factor,
    axis,
    metric_key,
    feature_key,
    feature_value,
    comparison_effective_date,
    'sp500'::text AS comparison_set_type,
    'all'::text AS comparison_set_key
  FROM base_features

  UNION ALL

  SELECT
    ticker,
    cik,
    factor,
    axis,
    metric_key,
    feature_key,
    feature_value,
    comparison_effective_date,
    'sector'::text AS comparison_set_type,
    sector AS comparison_set_key
  FROM base_features
  WHERE sector IS NOT NULL AND sector <> ''
)
`;

export const LATEST_COMPARISON_MEMBERS_CTE = `
WITH ${LATEST_COMPARISON_MEMBERS_CTE_BODY}
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
