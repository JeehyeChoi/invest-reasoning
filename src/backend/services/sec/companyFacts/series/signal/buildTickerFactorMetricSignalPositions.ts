import { db } from "@/backend/config/db";
import {
  buildComparisonQueryParams,
  LATEST_COMPARISON_MEMBERS_CTE,
  resolveBuildComparisonInput,
  type BuildComparisonInput,
} from "@/backend/services/sec/companyFacts/series/signal/comparisonMembersSql";

export async function buildTickerFactorMetricSignalPositions(
  input: BuildComparisonInput = {},
): Promise<void> {
  const resolvedInput = resolveBuildComparisonInput(input);

  await db.query(
    `
    ${LATEST_COMPARISON_MEMBERS_CTE},
    group_stats AS (
      SELECT
        factor,
        axis,
        metric_key,
        signal_key,
        comparison_set_type,
        comparison_set_key,
        comparison_effective_date,
        count(*)::integer AS universe_count,
        avg(signal_value)::double precision AS average_value,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY signal_value)::double precision AS median_value,
        stddev_pop(signal_value)::double precision AS stddev_value
      FROM comparison_members
      GROUP BY
        factor,
        axis,
        metric_key,
        signal_key,
        comparison_set_type,
        comparison_set_key,
        comparison_effective_date
    ),
    positioned AS (
      SELECT
        cm.ticker,
        cm.factor,
        cm.axis,
        cm.metric_key,
        cm.signal_key,
        cm.comparison_set_type,
        cm.comparison_set_key,
        cm.signal_value,
        percent_rank() OVER (
          PARTITION BY
            cm.factor,
            cm.axis,
            cm.metric_key,
            cm.signal_key,
            cm.comparison_set_type,
            cm.comparison_set_key,
            cm.comparison_effective_date
          ORDER BY cm.signal_value ASC
        )::double precision AS percentile,
        gs.average_value,
        gs.median_value,
        gs.stddev_value,
        gs.universe_count,
        cm.comparison_effective_date AS effective_date
      FROM comparison_members cm
      JOIN group_stats gs
        USING (
          factor,
          axis,
          metric_key,
          signal_key,
          comparison_set_type,
          comparison_set_key,
          comparison_effective_date
        )
    ),
    position_rows AS (
      SELECT
        ticker,
        factor,
        axis,
        metric_key,
        signal_key,
        comparison_set_type,
        comparison_set_key,
        signal_value,
        percentile,
        CASE
          WHEN stddev_value IS NULL OR stddev_value = 0 THEN NULL
          ELSE (signal_value - average_value) / stddev_value
        END::double precision AS z_score,
        (signal_value - median_value)::double precision AS distance_to_median,
        CASE
          WHEN percentile IS NULL THEN NULL
          ELSE least(4, greatest(1, floor(percentile * 4)::integer + 1))
        END AS quartile,
        CASE
          WHEN percentile IS NULL THEN NULL
          ELSE least(10, greatest(1, floor(percentile * 10)::integer + 1))
        END AS decile,
        universe_count,
        effective_date
      FROM positioned
    )
    INSERT INTO public.ticker_factor_metric_signal_positions (
      ticker,
      factor,
      axis,
      metric_key,
      signal_key,
      comparison_set_type,
      comparison_set_key,
      signal_value,
      percentile,
      z_score,
      distance_to_median,
      quartile,
      decile,
      universe_count,
      effective_date
    )
    SELECT
      ticker,
      factor,
      axis,
      metric_key,
      signal_key,
      comparison_set_type,
      comparison_set_key,
      signal_value,
      percentile,
      z_score,
      distance_to_median,
      quartile,
      decile,
      universe_count,
      effective_date
    FROM position_rows
    ON CONFLICT (
      ticker,
      factor,
      axis,
      metric_key,
      signal_key,
      comparison_set_type,
      comparison_set_key,
      effective_date
    )
    DO UPDATE SET
      signal_value = EXCLUDED.signal_value,
      percentile = EXCLUDED.percentile,
      z_score = EXCLUDED.z_score,
      distance_to_median = EXCLUDED.distance_to_median,
      quartile = EXCLUDED.quartile,
      decile = EXCLUDED.decile,
      universe_count = EXCLUDED.universe_count,
      updated_at = now()
    `,
    buildComparisonQueryParams(resolvedInput),
  );
}
