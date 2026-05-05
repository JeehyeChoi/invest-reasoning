import { db } from "@/backend/config/db";
import {
  buildComparisonQueryParams,
  LATEST_COMPARISON_MEMBERS_CTE_BODY,
  resolveBuildComparisonInput,
  type BuildComparisonInput,
} from "@/backend/services/sec/companyFacts/series/feature/comparisonMembersSql";
import { loadMetricFeatureUsageRules } from "@/backend/services/sec/companyFacts/series/feature/loadMetricFeatureUsageRules";

export async function buildTickerFactorMetricFeatureBaselines(
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
    DELETE FROM public.ticker_factor_metric_feature_baselines
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
        percentile_cont(0.25) WITHIN GROUP (ORDER BY feature_value)::double precision AS p25_value,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY feature_value)::double precision AS median_value,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY feature_value)::double precision AS p75_value,
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
    baseline_rows AS (
      SELECT
        factor,
        axis,
        metric_key,
        feature_key,
        comparison_set_type,
        comparison_set_key,
        baseline_key,
        baseline_value,
        universe_count,
        comparison_effective_date AS effective_date
      FROM group_stats
      CROSS JOIN LATERAL (
        VALUES
          ('average', average_value),
          ('p25', p25_value),
          ('median', median_value),
          ('p75', p75_value),
          ('stddev', stddev_value)
      ) AS baseline_values(baseline_key, baseline_value)
    )
    INSERT INTO public.ticker_factor_metric_feature_baselines (
      factor,
      axis,
      metric_key,
      feature_key,
      comparison_set_type,
      comparison_set_key,
      baseline_key,
      baseline_value,
      universe_count,
      effective_date
    )
    SELECT
      factor,
      axis,
      metric_key,
      feature_key,
      comparison_set_type,
      comparison_set_key,
      baseline_key,
      baseline_value,
      universe_count,
      effective_date
    FROM baseline_rows
    ON CONFLICT (
      factor,
      axis,
      metric_key,
      feature_key,
      comparison_set_type,
      comparison_set_key,
      baseline_key,
      effective_date
    )
    DO UPDATE SET
      baseline_value = EXCLUDED.baseline_value,
      universe_count = EXCLUDED.universe_count,
      updated_at = now()
    `,
    [...params, JSON.stringify(comparisonSignalRules)],
  );
}
