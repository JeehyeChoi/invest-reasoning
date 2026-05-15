import { db } from "@/backend/config/db";
import type { FactorKey } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type {
  MetricFeatureDefinition,
  MetricFeatureInterpretationConfig,
  MetricFeatureMetricKey,
} from "@/backend/services/sec/companyFacts/series/feature/types";

type ResolveInput = {
  factor: FactorKey;
  axis: FactorAxisKey;
  metricKey: MetricFeatureMetricKey;
};

const interpretationConfigCache = new Map<
  string,
  Promise<MetricFeatureInterpretationConfig>
>();

type FeatureDefinitionRow = {
  factor: FactorKey;
  axis: FactorAxisKey;
  metric_key: MetricFeatureMetricKey;
  feature_key: string;
  definition_payload: MetricFeatureDefinition;
};

function buildInterpretationCacheKey(input: ResolveInput): string {
  return `${input.factor}:${input.axis}:${input.metricKey}`;
}

export async function resolveMetricFeatureInterpretation(
  input: ResolveInput,
): Promise<MetricFeatureInterpretationConfig> {
  const cacheKey = buildInterpretationCacheKey(input);
  const cached = interpretationConfigCache.get(cacheKey);
  if (cached) return cached;

  const configPromise = readMetricFeatureInterpretation(input);
  interpretationConfigCache.set(cacheKey, configPromise);

  return configPromise;
}

async function readMetricFeatureInterpretation(
  input: ResolveInput,
): Promise<MetricFeatureInterpretationConfig> {
  const dbConfig = await readMetricFeatureInterpretationFromDb(input);
  if (!dbConfig) {
    throw new Error(
      `Factor feature definition not found in DB: ${input.factor}/${input.axis}/${input.metricKey}`,
    );
  }

  return dbConfig;
}

async function readMetricFeatureInterpretationFromDb(
  input: ResolveInput,
): Promise<MetricFeatureInterpretationConfig | null> {
  let result;

  result = await db.query<FeatureDefinitionRow>(
    `
      SELECT
        factor,
        axis,
        metric_key,
        feature_key,
        definition_payload
      FROM public.ticker_factor_feature_definitions
      WHERE model_key = 'factor_feature'
        AND model_version = 'v0'
        AND factor = $1
        AND axis = $2
        AND metric_key = $3
        AND is_active = true
      ORDER BY display_order ASC, feature_key ASC
      `,
    [input.factor, input.axis, input.metricKey],
  );

  if (result.rows.length === 0) return null;

  return {
    version: "interpretation_v1",
    factor: input.factor,
    axis: input.axis,
    metricKey: input.metricKey,
    features: Object.fromEntries(
      result.rows.map((row) => [row.feature_key, row.definition_payload]),
    ),
  };
}
