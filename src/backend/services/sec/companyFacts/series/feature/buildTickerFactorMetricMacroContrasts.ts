import { db } from "@/backend/config/db";
import { resolveFredMacroSeriesForMetric } from "@/backend/services/macro/fred/resolveFredMacroSeriesForMetric";
import {
  buildComparisonQueryParams,
  resolveBuildComparisonInput,
  type BuildComparisonInput,
} from "@/backend/services/sec/companyFacts/series/feature/comparisonMembersSql";
import { loadMetricFeatureUsageRules } from "@/backend/services/sec/companyFacts/series/feature/loadMetricFeatureUsageRules";
import { isSecMetricKey } from "@/shared/sec/metrics";

export async function buildTickerFactorMetricMacroContrasts(
  input: BuildComparisonInput = {},
): Promise<void> {
  const resolvedInput = resolveBuildComparisonInput(input);
  const params = buildComparisonQueryParams(resolvedInput);
  const macroContrastSignalRules = await loadMetricFeatureUsageRules({
    factor: resolvedInput.factor,
    axis: resolvedInput.axis,
    metricKey: resolvedInput.metricKey,
    usage: "macroContrast",
  });
  const macroSeriesRows = buildFredMacroSeriesMappingRows([
    ...new Set(macroContrastSignalRules.map((rule) => rule.metric_key)),
  ]);

  await db.query(
    `
    DELETE FROM public.ticker_factor_metric_macro_contrasts
    WHERE factor = $1
      AND axis = $2
      AND ($3::text IS NULL OR metric_key = $3)
      AND effective_date = COALESCE($4::date, current_date)
    `,
    params,
  );

  if (macroContrastSignalRules.length === 0 || macroSeriesRows.length === 0) {
    return;
  }

  const macroSeriesJson = JSON.stringify(macroSeriesRows);
  const macroSignalsJson = JSON.stringify(macroContrastSignalRules);

  await db.query(
    `
    WITH macro_eligible_signals AS (
      SELECT *
      FROM jsonb_to_recordset($6::jsonb) AS rows(
        factor text,
        axis text,
        metric_key text,
        feature_key text
      )
    ),
    macro_series AS (
      SELECT *
      FROM jsonb_to_recordset($5::jsonb) AS rows(
        metric_key text,
        macro_series_key text,
        macro_series_id text,
        macro_units text,
        macro_frequency text
      )
    ),
    latest_signals AS (
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
        s.period_end,
        s.effective_date
      FROM public.ticker_factor_metric_features s
      WHERE s.factor = $1
        AND s.axis = $2
        AND ($3::text IS NULL OR s.metric_key = $3)
        AND ($4::date IS NULL OR s.effective_date <= $4)
        AND s.feature_value IS NOT NULL
        AND s.period_end IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM macro_eligible_signals allowed
          WHERE allowed.factor = s.factor
            AND allowed.axis = s.axis
            AND allowed.metric_key = s.metric_key
            AND allowed.feature_key = s.feature_key
        )
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
    contrast_rows AS (
      SELECT
        s.ticker,
        s.cik,
        s.factor,
        s.axis,
        s.metric_key,
        s.feature_key,
        s.feature_value,
        s.period_end AS feature_period_end,
        s.effective_date AS feature_effective_date,
        'usa'::text AS macro_scope,
        'fred'::text AS macro_provider,
        ms.macro_series_key,
        ms.macro_series_id,
        ms.macro_units,
        ms.macro_frequency,
        macro_observation.observation_date AS macro_observation_date,
        (macro_observation.value / 100.0)::double precision AS macro_value,
        'feature_minus_macro'::text AS contrast_method,
        (
          s.feature_value - (macro_observation.value / 100.0)
        )::double precision AS contrast_value,
        COALESCE($4::date, current_date) AS effective_date
      FROM latest_signals s
      JOIN macro_series ms
        ON ms.metric_key = s.metric_key
      JOIN LATERAL (
        SELECT
          f.observation_date,
          f.value
        FROM public.fred_macro_series_observations f
        WHERE f.series_id = ms.macro_series_id
          AND f.units = ms.macro_units
          AND f.value IS NOT NULL
          AND f.observation_date <= s.period_end
        ORDER BY f.observation_date DESC
        LIMIT 1
      ) AS macro_observation ON true
    )
    INSERT INTO public.ticker_factor_metric_macro_contrasts (
      ticker,
      cik,
      factor,
      axis,
      metric_key,
      feature_key,
      feature_value,
      feature_period_end,
      feature_effective_date,
      macro_scope,
      macro_provider,
      macro_series_key,
      macro_series_id,
      macro_units,
      macro_frequency,
      macro_observation_date,
      macro_value,
      contrast_method,
      contrast_value,
      effective_date
    )
    SELECT
      ticker,
      cik,
      factor,
      axis,
      metric_key,
      feature_key,
      feature_value,
      feature_period_end,
      feature_effective_date,
      macro_scope,
      macro_provider,
      macro_series_key,
      macro_series_id,
      macro_units,
      macro_frequency,
      macro_observation_date,
      macro_value,
      contrast_method,
      contrast_value,
      effective_date
    FROM contrast_rows
    ON CONFLICT (
      ticker,
      factor,
      axis,
      metric_key,
      feature_key,
      macro_scope,
      macro_provider,
      macro_series_key,
      effective_date
    )
    DO UPDATE SET
      feature_value = EXCLUDED.feature_value,
      feature_period_end = EXCLUDED.feature_period_end,
      feature_effective_date = EXCLUDED.feature_effective_date,
      macro_series_id = EXCLUDED.macro_series_id,
      macro_units = EXCLUDED.macro_units,
      macro_frequency = EXCLUDED.macro_frequency,
      macro_observation_date = EXCLUDED.macro_observation_date,
      macro_value = EXCLUDED.macro_value,
      contrast_method = EXCLUDED.contrast_method,
      contrast_value = EXCLUDED.contrast_value,
      updated_at = now()
    `,
    [...params, macroSeriesJson, macroSignalsJson],
  );
}

type FredMacroSeriesMappingRow = {
  metric_key: string;
  macro_series_key: string;
  macro_series_id: string;
  macro_units: string;
  macro_frequency: string;
};

function buildFredMacroSeriesMappingRows(
  metricKeys: string[],
): FredMacroSeriesMappingRow[] {
  return metricKeys.flatMap((candidateMetricKey) => {
    if (!isSecMetricKey(candidateMetricKey)) {
      return [];
    }

    return resolveFredMacroSeriesForMetric(candidateMetricKey).map(
      (definition) => ({
        metric_key: candidateMetricKey,
        macro_series_key: definition.key,
        macro_series_id: definition.seriesId,
        macro_units: definition.units,
        macro_frequency: definition.frequency,
      }),
    );
  });
}
