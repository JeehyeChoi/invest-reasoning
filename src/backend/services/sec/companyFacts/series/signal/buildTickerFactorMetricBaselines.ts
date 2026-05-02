import { db } from "@/backend/config/db";
import {
  buildComparisonQueryParams,
  LATEST_COMPARISON_MEMBERS_CTE,
  resolveBuildComparisonInput,
  type BuildComparisonInput,
} from "@/backend/services/sec/companyFacts/series/signal/comparisonMembersSql";

export async function buildTickerFactorMetricBaselines(
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
        percentile_cont(0.25) WITHIN GROUP (ORDER BY signal_value)::double precision AS p25_value,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY signal_value)::double precision AS median_value,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY signal_value)::double precision AS p75_value,
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
    baseline_rows AS (
      SELECT
        factor,
        axis,
        metric_key,
        signal_key,
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
    INSERT INTO public.ticker_factor_metric_baselines (
      factor,
      axis,
      metric_key,
      signal_key,
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
      signal_key,
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
      signal_key,
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
    buildComparisonQueryParams(resolvedInput),
  );
}
