import { db } from "@/backend/config/db";
import {
  buildComparisonQueryParams,
  LATEST_COMPARISON_MEMBERS_CTE_BODY,
  resolveBuildComparisonInput,
  type BuildComparisonInput,
} from "@/backend/services/sec/companyFacts/series/feature/comparisonMembersSql";
import { loadMetricFeatureUsageRules } from "@/backend/services/sec/companyFacts/series/feature/loadMetricFeatureUsageRules";

export async function buildTickerFactorMetricFeaturePositions(
  input: BuildComparisonInput = {},
): Promise<void> {
  const resolvedInput = resolveBuildComparisonInput(input);
  const params = buildComparisonQueryParams(resolvedInput);
  const comparisonSignalRules = await loadMetricFeatureUsageRules({
    factor: resolvedInput.factor,
    axis: resolvedInput.axis,
    metricKey: resolvedInput.metricKey,
    usage: "comparison",
  });

  await db.query(
    `
    DELETE FROM public.ticker_factor_metric_feature_positions
    WHERE factor = $1
      AND axis = $2
      AND ($3::text IS NULL OR metric_key = $3)
      AND effective_date = COALESCE($4::date, current_date)
    `,
    params,
  );

  if (comparisonSignalRules.length === 0) {
    return;
  }

  await db.query(
    `
    WITH allowed_signals AS (
      SELECT *
      FROM jsonb_to_recordset($5::jsonb) AS rows(
        factor text,
        axis text,
        metric_key text,
        feature_key text
      )
    ),
    ${LATEST_COMPARISON_MEMBERS_CTE_BODY},
    group_stats AS (
      SELECT
        factor,
        axis,
        metric_key,
        feature_key,
        comparison_set_type,
        comparison_set_key,
        comparison_effective_date,
        count(*)::integer AS universe_count,
        avg(feature_value)::double precision AS average_value,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY feature_value)::double precision AS median_value,
        stddev_pop(feature_value)::double precision AS stddev_value
      FROM comparison_members
      JOIN allowed_signals
        USING (factor, axis, metric_key, feature_key)
      GROUP BY
        factor,
        axis,
        metric_key,
        feature_key,
        comparison_set_type,
        comparison_set_key,
        comparison_effective_date
    ),
    positioned AS (
      SELECT
        cm.ticker,
        cm.cik,
        cm.factor,
        cm.axis,
        cm.metric_key,
        cm.feature_key,
        cm.comparison_set_type,
        cm.comparison_set_key,
        cm.feature_value,
        percent_rank() OVER (
          PARTITION BY
            cm.factor,
            cm.axis,
            cm.metric_key,
            cm.feature_key,
            cm.comparison_set_type,
            cm.comparison_set_key,
            cm.comparison_effective_date
          ORDER BY cm.feature_value ASC
        )::double precision AS percentile,
        gs.average_value,
        gs.median_value,
        gs.stddev_value,
        gs.universe_count,
        cm.comparison_effective_date AS effective_date
      FROM comparison_members cm
      JOIN allowed_signals
        USING (factor, axis, metric_key, feature_key)
      JOIN group_stats gs
        USING (
          factor,
          axis,
          metric_key,
          feature_key,
          comparison_set_type,
          comparison_set_key,
          comparison_effective_date
        )
    ),
    position_rows AS (
      SELECT
        ticker,
        cik,
        factor,
        axis,
        metric_key,
        feature_key,
        comparison_set_type,
        comparison_set_key,
        feature_value,
        percentile,
        CASE
          WHEN stddev_value IS NULL OR stddev_value = 0 THEN NULL
          ELSE (feature_value - average_value) / stddev_value
        END::double precision AS z_score,
        (feature_value - median_value)::double precision AS distance_to_median,
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
    INSERT INTO public.ticker_factor_metric_feature_positions (
      ticker,
      cik,
      factor,
      axis,
      metric_key,
      feature_key,
      comparison_set_type,
      comparison_set_key,
      feature_value,
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
      cik,
      factor,
      axis,
      metric_key,
      feature_key,
      comparison_set_type,
      comparison_set_key,
      feature_value,
      percentile,
      z_score,
      distance_to_median,
      quartile,
      decile,
      universe_count,
      effective_date
    FROM position_rows
    ON CONFLICT (
      cik,
      factor,
      axis,
      metric_key,
      feature_key,
      comparison_set_type,
      comparison_set_key,
      effective_date
    )
    DO UPDATE SET
      ticker = EXCLUDED.ticker,
      feature_value = EXCLUDED.feature_value,
      percentile = EXCLUDED.percentile,
      z_score = EXCLUDED.z_score,
      distance_to_median = EXCLUDED.distance_to_median,
      quartile = EXCLUDED.quartile,
      decile = EXCLUDED.decile,
      universe_count = EXCLUDED.universe_count,
      updated_at = now()
    `,
    [...params, JSON.stringify(comparisonSignalRules)],
  );
}
