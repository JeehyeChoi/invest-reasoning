import { db } from "@/backend/config/db";
import { loadMetricFeatureUsageRules } from "@/backend/services/sec/companyFacts/series/feature/loadMetricFeatureUsageRules";
import type {
  TickerVector,
  TickerVectorizationInput,
  TickerVectorMatrix,
  TickerVectorSourceRow,
} from "@/backend/services/ticker-vectorization/types";

type FeatureNormalizationStats = {
  median: number;
  scale: number;
};

export async function buildTickerVectorMatrix(
  input: TickerVectorizationInput,
): Promise<TickerVectorMatrix> {
  validateVectorPolicy(input);
  const rows = await loadLatestVectorRows(input);

  return buildMatrixFromRows(rows, input);
}

function validateVectorPolicy(input: TickerVectorizationInput): void {
  if (
    input.vectorMode === "factor_signal" &&
    input.vectorSourcePolicy !== "signal_activation"
  ) {
    throw new Error(
      "Factor signal vectors require vectorSourcePolicy=signal_activation.",
    );
  }

  if (
    input.vectorMode === "metric_feature" &&
    input.vectorSourcePolicy === "signal_activation"
  ) {
    throw new Error(
      "Signal activation vectors require vectorMode=factor_signal.",
    );
  }

}

async function loadLatestVectorRows(
  input: TickerVectorizationInput,
): Promise<TickerVectorSourceRow[]> {
  if (input.vectorMode === "factor_signal") {
    return loadLatestSignalActivationRows(input);
  }

  return loadLatestFeatureValueRows(input);
}

async function loadLatestSignalActivationRows(
  input: TickerVectorizationInput,
): Promise<TickerVectorSourceRow[]> {
  const result = await db.query<TickerVectorSourceRow>(
    `
      SELECT DISTINCT ON (
        s.ticker,
        s.factor,
        s.axis
      )
        s.ticker,
        s.cik,
        s.factor,
        s.axis,
        'signal'::text AS metric_key,
        s.signal_key AS feature_key,
        1::double precision AS feature_value,
        NULL::integer AS universe_count,
        s.signal_period_end AS period_end,
        s.signal_effective_date AS effective_date
      FROM public.ticker_factor_signals s
      WHERE (s.factor, s.axis) IN (
          SELECT target.factor, target.axis
          FROM unnest($1::text[], $2::text[]) AS target(factor, axis)
        )
        AND s.model_key = 'factor_signal'
        AND s.model_version = 'v0'
        AND ($3::date IS NULL OR s.signal_effective_date <= $3)
        AND s.signal_key IS NOT NULL
      ORDER BY
        s.ticker,
        s.factor,
        s.axis,
        s.signal_effective_date DESC,
        s.signal_period_end DESC
    `,
    [
      input.targets.map((target) => target.factor),
      input.targets.map((target) => target.axis),
      input.asOfDate ?? null,
    ],
  );

  return result.rows;
}

async function loadLatestFeatureValueRows(
  input: TickerVectorizationInput,
): Promise<TickerVectorSourceRow[]> {
  const clusteringFeatureRules = await loadClusteringFeatureRules(input);

  if (clusteringFeatureRules.length === 0) return [];

  const result = await db.query<TickerVectorSourceRow>(
    `
      WITH allowed_features AS (
        SELECT *
        FROM jsonb_to_recordset($4::jsonb) AS rows(
          factor text,
          axis text,
          metric_key text,
          feature_key text
        )
      )
      SELECT DISTINCT ON (
        COALESCE(p.cik, p.ticker),
        p.factor,
        p.axis,
        p.metric_key,
        p.feature_key
      )
        p.ticker,
        p.cik,
        p.factor,
        p.axis,
        p.metric_key,
        p.feature_key,
        p.feature_value,
        NULL::integer AS universe_count,
        p.period_end,
        p.effective_date
      FROM public.ticker_factor_metric_features p
      JOIN allowed_features
        USING (factor, axis, metric_key, feature_key)
      WHERE (p.factor, p.axis) IN (
          SELECT target.factor, target.axis
          FROM unnest($1::text[], $2::text[]) AS target(factor, axis)
        )
        AND ($3::date IS NULL OR p.effective_date <= $3)
        AND p.feature_value IS NOT NULL
      ORDER BY
        COALESCE(p.cik, p.ticker),
        p.factor,
        p.axis,
        p.metric_key,
        p.feature_key,
        p.effective_date DESC,
        p.period_end DESC,
        p.ticker ASC
    `,
    [
      input.targets.map((target) => target.factor),
      input.targets.map((target) => target.axis),
      input.asOfDate ?? null,
      JSON.stringify(clusteringFeatureRules),
    ],
  );

  return result.rows;
}

async function loadClusteringFeatureRules(input: TickerVectorizationInput) {
  return (
    await Promise.all(
      input.targets.map((target) =>
        loadMetricFeatureUsageRules({
          factor: target.factor,
          axis: target.axis,
          usage: "clustering",
        }),
      ),
    )
  ).flat();
}

function buildMatrixFromRows(
  rows: TickerVectorSourceRow[],
  input: TickerVectorizationInput,
): TickerVectorMatrix {
  const tickerKeys = new Set(rows.map((row) => row.ticker));
  const minFeatureObservations =
    input.vectorMode === "factor_signal"
      ? 1
      : Math.max(1, Math.ceil(tickerKeys.size * input.minFeatureCoverageRatio));

  const featureObservationCounts = new Map<string, number>();
  const tickerFeatureValues = new Map<string, Map<string, number>>();
  let vectorEffectiveDate = input.asOfDate ?? rows[0]?.effective_date;

  for (const row of rows) {
    const sourceValue = getVectorSourceValue(row);
    if (sourceValue === null) continue;

    vectorEffectiveDate =
      row.effective_date > vectorEffectiveDate
        ? row.effective_date
        : vectorEffectiveDate;

    const featureKey = buildFeatureKey(row);
    featureObservationCounts.set(
      featureKey,
      (featureObservationCounts.get(featureKey) ?? 0) + 1,
    );

    const featureValues =
      tickerFeatureValues.get(row.ticker) ?? new Map<string, number>();
    featureValues.set(featureKey, sourceValue);
    tickerFeatureValues.set(row.ticker, featureValues);
  }

  const featureKeys = [...featureObservationCounts.entries()]
    .filter(([, count]) => count >= minFeatureObservations)
    .map(([featureKey]) => featureKey)
    .sort();
  const featureStats = buildFeatureNormalizationStats(
    tickerFeatureValues,
    featureKeys,
  );

  const vectors: TickerVector[] = [];

  for (const [ticker, featureValues] of tickerFeatureValues.entries()) {
    const values = featureKeys.map(
      (featureKey) =>
        normalizeVectorValue({
          sourceValue: featureValues.get(featureKey) ?? null,
          stats: featureStats.get(featureKey),
          input,
        }) ?? 0,
    );
    const observedFeatureCount =
      input.vectorMode === "factor_signal"
        ? featureKeys.length
        : featureKeys.reduce(
            (count, featureKey) => count + (featureValues.has(featureKey) ? 1 : 0),
            0,
          );
    const missingFeatureCount =
      input.vectorMode === "factor_signal"
        ? 0
        : featureKeys.length - observedFeatureCount;
    const coverageRatio =
      featureKeys.length === 0 ? 0 : observedFeatureCount / featureKeys.length;

    if (coverageRatio < input.minTickerCoverageRatio) continue;

    vectors.push({
      ticker,
      values,
      observedFeatureCount,
      missingFeatureCount,
      coverageRatio,
    });
  }

  vectors.sort((a, b) => a.ticker.localeCompare(b.ticker));

  return {
    featureKeys,
    vectors,
    vectorEffectiveDate,
  };
}

function getVectorSourceValue(row: TickerVectorSourceRow): number | null {
  return row.feature_value;
}

function buildFeatureNormalizationStats(
  tickerFeatureValues: Map<string, Map<string, number>>,
  featureKeys: string[],
): Map<string, FeatureNormalizationStats> {
  const stats = new Map<string, FeatureNormalizationStats>();

  for (const featureKey of featureKeys) {
    const values = [...tickerFeatureValues.values()]
      .map((featureValues) => featureValues.get(featureKey))
      .filter((value): value is number => value !== undefined);
    const featureMedian = median(values);
    const absoluteDeviations = values.map((value) =>
      Math.abs(value - featureMedian),
    );
    const mad = median(absoluteDeviations);
    const scale = mad === 0 ? standardDeviation(values) : mad * 1.4826;

    stats.set(featureKey, {
      median: featureMedian,
      scale: scale === 0 ? 1 : scale,
    });
  }

  return stats;
}

function normalizeVectorValue(input: {
  sourceValue: number | null;
  stats: FeatureNormalizationStats | undefined;
  input: TickerVectorizationInput;
}): number | null {
  if (input.sourceValue === null) return null;

  if (input.input.normalizationMethod === "robust_z_score") {
    const stats = input.stats;
    if (!stats) return null;

    return clamp(
      (input.sourceValue - stats.median) / stats.scale,
      -input.input.zScoreClip,
      input.input.zScoreClip,
    );
  }

  if (input.input.normalizationMethod === "none") return input.sourceValue;
  if (input.sourceValue > 0) return 1;
  if (input.sourceValue < 0) return -1;
  return 0;
}

function buildFeatureKey(row: TickerVectorSourceRow): string {
  return `${row.factor}.${row.axis}.${row.metric_key}.${row.feature_key}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}
