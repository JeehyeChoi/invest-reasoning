import { db } from "@/backend/config/db";
import {
  buildComparisonQueryParams,
  resolveBuildComparisonInput,
  type BuildComparisonInput,
} from "@/backend/services/sec/companyFacts/series/signal/comparisonMembersSql";

export async function buildTickerFactorMetricSignalHeadlines(
  input: BuildComparisonInput = {},
): Promise<void> {
  const resolvedInput = resolveBuildComparisonInput(input);
  const params = buildComparisonQueryParams(resolvedInput);

  await db.query(
    `
    DELETE FROM public.ticker_factor_metric_signal_headlines
    WHERE factor = $1
      AND axis = $2
      AND ($3::text IS NULL OR metric_key = $3)
      AND headline_effective_date = COALESCE($4::date, current_date)
    `,
    params,
  );

  await db.query(
    `
    WITH scoped_signals AS (
      SELECT
        ticker,
        cik,
        factor,
        axis,
        metric_key,
        signal_key,
        signal_value,
        period_end,
        effective_date,
        source_table,
        source_version,
        row_number() OVER (
          PARTITION BY ticker, factor, axis, metric_key, signal_key
          ORDER BY effective_date DESC, period_end DESC
        ) AS latest_rank,
        row_number() OVER (
          PARTITION BY ticker, factor, axis, metric_key, signal_key
          ORDER BY effective_date DESC, period_end DESC
        ) AS recent_rank
      FROM public.ticker_factor_metric_signals
      WHERE factor = $1
        AND axis = $2
        AND ($3::text IS NULL OR metric_key = $3)
        AND ($4::date IS NULL OR effective_date <= $4)
        AND signal_value IS NOT NULL
    ),
    signal_windows AS (
      SELECT
        ticker,
        max(cik) AS cik,
        factor,
        axis,
        metric_key,
        max(period_end) AS headline_period_end,
        max(COALESCE($4::date, current_date)) AS headline_effective_date,
        max(source_table) AS source_table,
        max(source_version) AS source_version,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY signal_value
        ) FILTER (
          WHERE signal_key = 'latestGrowth' AND recent_rank <= 4
        )::double precision AS latest_growth_value,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY signal_value
        ) FILTER (
          WHERE signal_key = 'durableGrowth' AND recent_rank <= 5
        )::double precision AS durable_growth_value,
        max(signal_value) FILTER (
          WHERE signal_key = 'consistency' AND latest_rank = 1
        )::double precision AS consistency_value,
        max(signal_value) FILTER (
          WHERE signal_key = 'coverage' AND latest_rank = 1
        )::double precision AS coverage_value,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY signal_value
        ) FILTER (
          WHERE signal_key = 'acceleration' AND recent_rank <= 4
        )::double precision AS acceleration_value,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY signal_value
        ) FILTER (
          WHERE signal_key = 'trendDeviation' AND recent_rank <= 4
        )::double precision AS trend_deviation_value
      FROM scoped_signals
      GROUP BY ticker, factor, axis, metric_key
    ),
    headline_rows AS (
      SELECT
        *,
        CASE
          WHEN durable_growth_value IS NOT NULL THEN 'durableGrowth'
          WHEN latest_growth_value IS NOT NULL THEN 'latestGrowth'
          ELSE NULL
        END AS primary_signal_key,
        CASE
          WHEN durable_growth_value IS NOT NULL THEN durable_growth_value
          WHEN latest_growth_value IS NOT NULL THEN latest_growth_value
          ELSE NULL
        END AS primary_signal_value,
        CASE
          WHEN durable_growth_value IS NOT NULL THEN 'recent_5q_median'
          WHEN latest_growth_value IS NOT NULL THEN 'recent_4q_median'
          ELSE NULL
        END AS primary_signal_method,
        CASE
          WHEN coverage_value >= 0.75 THEN 'high'
          WHEN coverage_value >= 0.5 THEN 'medium'
          ELSE 'low'
        END AS data_quality_level
      FROM signal_windows
      WHERE headline_period_end IS NOT NULL
    )
    INSERT INTO public.ticker_factor_metric_signal_headlines (
      ticker,
      cik,
      factor,
      axis,
      metric_key,
      headline_period_end,
      headline_effective_date,
      latest_growth_value,
      latest_growth_method,
      durable_growth_value,
      durable_growth_method,
      consistency_value,
      consistency_method,
      coverage_value,
      coverage_method,
      acceleration_value,
      acceleration_method,
      trend_deviation_value,
      trend_deviation_method,
      primary_signal_key,
      primary_signal_value,
      primary_signal_method,
      data_quality_level,
      source_table,
      source_version
    )
    SELECT
      ticker,
      cik,
      factor,
      axis,
      metric_key,
      headline_period_end,
      headline_effective_date,
      latest_growth_value,
      CASE WHEN latest_growth_value IS NOT NULL THEN 'recent_4q_median' END,
      durable_growth_value,
      CASE WHEN durable_growth_value IS NOT NULL THEN 'recent_5q_median' END,
      consistency_value,
      CASE WHEN consistency_value IS NOT NULL THEN 'latest' END,
      coverage_value,
      CASE WHEN coverage_value IS NOT NULL THEN 'latest' END,
      acceleration_value,
      CASE WHEN acceleration_value IS NOT NULL THEN 'recent_4q_median' END,
      trend_deviation_value,
      CASE WHEN trend_deviation_value IS NOT NULL THEN 'recent_4q_median' END,
      primary_signal_key,
      primary_signal_value,
      primary_signal_method,
      data_quality_level,
      source_table,
      source_version
    FROM headline_rows
    ON CONFLICT (
      ticker,
      factor,
      axis,
      metric_key,
      headline_effective_date
    )
    DO UPDATE SET
      cik = EXCLUDED.cik,
      headline_period_end = EXCLUDED.headline_period_end,
      latest_growth_value = EXCLUDED.latest_growth_value,
      latest_growth_method = EXCLUDED.latest_growth_method,
      durable_growth_value = EXCLUDED.durable_growth_value,
      durable_growth_method = EXCLUDED.durable_growth_method,
      consistency_value = EXCLUDED.consistency_value,
      consistency_method = EXCLUDED.consistency_method,
      coverage_value = EXCLUDED.coverage_value,
      coverage_method = EXCLUDED.coverage_method,
      acceleration_value = EXCLUDED.acceleration_value,
      acceleration_method = EXCLUDED.acceleration_method,
      trend_deviation_value = EXCLUDED.trend_deviation_value,
      trend_deviation_method = EXCLUDED.trend_deviation_method,
      primary_signal_key = EXCLUDED.primary_signal_key,
      primary_signal_value = EXCLUDED.primary_signal_value,
      primary_signal_method = EXCLUDED.primary_signal_method,
      data_quality_level = EXCLUDED.data_quality_level,
      source_table = EXCLUDED.source_table,
      source_version = EXCLUDED.source_version,
      updated_at = now()
    `,
    params,
  );
}
