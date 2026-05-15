import { db } from "@/backend/config/db";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { FactorKey } from "@/shared/factors/factors";
import type { MetricFeatureMetricKey } from "@/backend/services/sec/companyFacts/series/feature/types";

export type MetricFeatureUsageKind =
  | "comparison"
  | "macroContrast"
  | "clustering";

export type MetricFeatureUsageRule = {
  factor: FactorKey;
  axis: FactorAxisKey;
  metric_key: MetricFeatureMetricKey;
  feature_key: string;
};

type LoadInput = {
  factor: FactorKey;
  axis: FactorAxisKey;
  metricKey?: MetricFeatureMetricKey;
  usage: MetricFeatureUsageKind;
};

type FeatureUsageDefinitionRow = {
  factor: FactorKey;
  axis: FactorAxisKey;
  metric_key: MetricFeatureMetricKey;
  feature_key: string;
};

export async function loadMetricFeatureUsageRules(
  input: LoadInput,
): Promise<MetricFeatureUsageRule[]> {
  return loadMetricFeatureUsageRulesFromDb(input);
}

async function loadMetricFeatureUsageRulesFromDb(
  input: LoadInput,
): Promise<MetricFeatureUsageRule[]> {
  const usageColumn =
    input.usage === "comparison"
      ? "comparison"
      : input.usage === "macroContrast"
        ? "macro_contrast"
        : "is_vector_eligible";
  const result = await db.query<FeatureUsageDefinitionRow>(
    `
      SELECT
        factor,
        axis,
        metric_key,
        feature_key
      FROM public.ticker_factor_feature_definitions
      WHERE model_key = 'factor_feature'
        AND model_version = 'v0'
        AND factor = $1
        AND axis = $2
        AND ($3::text IS NULL OR metric_key = $3)
        AND is_active = true
        AND ${usageColumn} = true
      ORDER BY display_order ASC, metric_key ASC, feature_key ASC
      `,
    [input.factor, input.axis, input.metricKey ?? null],
  );

  return result.rows.map((row) => ({
    factor: row.factor,
    axis: row.axis,
    metric_key: row.metric_key,
    feature_key: row.feature_key,
  }));
}
