import { db } from "@/backend/config/db";
import type { FactorKey } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { FactorBlueprintMetricKey } from "@/backend/config/factors/blueprints";

export type FactorConfigResolveInput = {
  factor: FactorKey;
  axis: FactorAxisKey;
  metricKey: FactorBlueprintMetricKey | string;
};

type FeatureDisplayDefinitionRow = {
  feature_key: string;
  feature_label: string;
  feature_description: string | null;
  metric_label: string | null;
  metric_description: string | null;
  axis_label: string | null;
  axis_display_payload: Record<string, any> | null;
  metric_display_payload: Record<string, any> | null;
};

function mergeFactorDisplay(commonDisplay: any, metricDisplay: any) {
  const merged = {
    ...(commonDisplay ?? {}),
    ...(metricDisplay ?? {}),
    chart: {
      ...(commonDisplay?.chart ?? {}),
      ...(metricDisplay?.chart ?? {}),
    },
    featureLabels: {
      ...(commonDisplay?.featureLabels ?? {}),
      ...(metricDisplay?.featureLabels ?? {}),
    },
    baselineLabels: {
      ...(commonDisplay?.baselineLabels ?? {}),
      ...(metricDisplay?.baselineLabels ?? {}),
    },
  };

  return {
    ...merged,
    metricOrder: merged.metricOrder ?? merged.featureOrder ?? [],
    metricLabels: merged.metricLabels ?? merged.featureLabels ?? {},
  };
}

export async function resolveFactorDisplay(input: FactorConfigResolveInput) {
  const dbDisplay = await resolveFactorDisplayFromDb(input);
  if (!dbDisplay) {
    throw new Error(
      `Factor display definition not found in DB: ${input.factor}/${input.axis}/${input.metricKey}`,
    );
  }

  return dbDisplay;
}

async function resolveFactorDisplayFromDb(input: FactorConfigResolveInput) {
  const result = await db.query<FeatureDisplayDefinitionRow>(
    `
      SELECT
        f.feature_key,
        f.feature_label,
        f.feature_description,
        md.metric_label,
        md.metric_description,
        ad.axis_label,
        ad.display_payload AS axis_display_payload,
        md.display_payload AS metric_display_payload
      FROM public.ticker_factor_feature_definitions f
      LEFT JOIN public.ticker_factor_metric_display_definitions md
        ON md.model_key = f.model_key
       AND md.model_version = f.model_version
       AND md.factor = f.factor
       AND md.axis = f.axis
       AND md.metric_key = f.metric_key
       AND md.is_active = true
      LEFT JOIN public.ticker_factor_axis_display_definitions ad
        ON ad.model_key = f.model_key
       AND ad.model_version = f.model_version
       AND ad.factor = f.factor
       AND ad.axis = f.axis
       AND ad.is_active = true
      WHERE f.model_key = 'factor_feature'
        AND f.model_version = 'v0'
        AND f.factor = $1
        AND f.axis = $2
        AND f.metric_key = $3
        AND f.is_active = true
      ORDER BY f.display_order ASC, f.feature_key ASC
      `,
    [input.factor, input.axis, input.metricKey],
  );

  if (result.rows.length === 0) return null;

  const first = result.rows[0];
  const commonDisplay = first?.axis_display_payload ?? {};
  const metricDisplay = first?.metric_display_payload ?? {};
  const featureLabels = Object.fromEntries(
    result.rows.map((row) => [row.feature_key, row.feature_label]),
  );
  const featureDescriptions = Object.fromEntries(
    result.rows
      .filter((row) => row.feature_description)
      .map((row) => [row.feature_key, row.feature_description]),
  );

  return mergeFactorDisplay(commonDisplay, {
    ...metricDisplay,
    label: metricDisplay?.label ?? first?.metric_label ?? undefined,
    description:
      metricDisplay?.description ?? first?.metric_description ?? undefined,
    axisLabel: commonDisplay?.axisLabel ?? first?.axis_label ?? undefined,
    featureLabels: {
      ...(metricDisplay?.featureLabels ?? {}),
      ...featureLabels,
    },
    featureDescriptions: {
      ...(metricDisplay?.featureDescriptions ?? {}),
      ...featureDescriptions,
    },
  });
}
