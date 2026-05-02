import { db } from "@/backend/config/db";
import type { FactorKey, FactorScoreAxisKey } from "@/shared/factors/factors";

export type TickerClusterNormalizationMethod =
  | "z_score"
  | "percentile"
  | "sign";

export type TickerClusterMethod = "kmeans";

export type RunTickerFactorMetricClusteringInput = {
  factor?: FactorKey;
  axis?: FactorScoreAxisKey;
  comparisonSetType?: string;
  comparisonSetKey?: string;
  asOfDate?: string;
  normalizationMethod?: TickerClusterNormalizationMethod;
  clusterMethod?: TickerClusterMethod;
  clusterCount?: number;
  maxIterations?: number;
  minTickerCoverageRatio?: number;
  minFeatureCoverageRatio?: number;
  minUniverseCount?: number;
};

export type TickerFactorMetricClusterProfile = {
  clusterId: number;
  label: string;
  size: number;
  averageCoverageRatio: number;
  averageDistanceToCentroid: number | null;
  distinguishingFeatures: ClusterFeatureSummary[];
};

export type RunTickerFactorMetricClusteringResult = {
  runId: string;
  tickerCount: number;
  featureCount: number;
  clusterCount: number;
  profiles: TickerFactorMetricClusterProfile[];
};

type ResolvedInput = Required<
  Pick<
    RunTickerFactorMetricClusteringInput,
    | "factor"
    | "axis"
    | "comparisonSetType"
    | "comparisonSetKey"
    | "normalizationMethod"
    | "clusterMethod"
    | "clusterCount"
    | "maxIterations"
    | "minTickerCoverageRatio"
    | "minFeatureCoverageRatio"
    | "minUniverseCount"
  >
> &
  Pick<RunTickerFactorMetricClusteringInput, "asOfDate">;

type PositionRow = {
  ticker: string;
  factor: string;
  axis: string;
  metric_key: string;
  signal_key: string;
  signal_value: number | null;
  percentile: number | null;
  z_score: number | null;
  universe_count: number | null;
  effective_date: string;
};

type TickerVector = {
  ticker: string;
  values: number[];
  observedFeatureCount: number;
  missingFeatureCount: number;
  coverageRatio: number;
};

type KMeansResult = {
  assignments: number[];
  centroids: number[][];
  distances: number[];
};

type ClusterFeatureSummary = {
  featureKey: string;
  metricKey: string;
  signalKey: string;
  value: number;
  direction: "high" | "low";
};

type ClusterProfileDraft = TickerFactorMetricClusterProfile & {
  centroid: number[];
};

function resolveInput(
  input: RunTickerFactorMetricClusteringInput,
): ResolvedInput {
  return {
    factor: input.factor ?? "growth",
    axis: input.axis ?? "fundamentals_based",
    comparisonSetType: input.comparisonSetType ?? "usa",
    comparisonSetKey: input.comparisonSetKey ?? "all",
    asOfDate: input.asOfDate,
    normalizationMethod: input.normalizationMethod ?? "z_score",
    clusterMethod: input.clusterMethod ?? "kmeans",
    clusterCount: input.clusterCount ?? 6,
    maxIterations: input.maxIterations ?? 100,
    minTickerCoverageRatio: input.minTickerCoverageRatio ?? 0.45,
    minFeatureCoverageRatio: input.minFeatureCoverageRatio ?? 0.35,
    minUniverseCount: input.minUniverseCount ?? 25,
  };
}

export async function runTickerFactorMetricClustering(
  input: RunTickerFactorMetricClusteringInput = {},
): Promise<RunTickerFactorMetricClusteringResult> {
  const resolvedInput = resolveInput(input);
  const rows = await loadLatestPositionRows(resolvedInput);
  const matrix = buildVectorMatrix(rows, resolvedInput);

  if (matrix.vectors.length === 0 || matrix.featureKeys.length === 0) {
    throw new Error("No ticker vectors available for clustering.");
  }

  const clusterCount = Math.min(
    resolvedInput.clusterCount,
    matrix.vectors.length,
  );

  const kmeans = runKMeans(
    matrix.vectors.map((vector) => vector.values),
    clusterCount,
    resolvedInput.maxIterations,
  );

  const profiles = buildClusterProfiles({
    vectors: matrix.vectors,
    featureKeys: matrix.featureKeys,
    kmeans,
  });

  const runId = buildRunId(resolvedInput);

  await persistClusterRun({
    runId,
    input: resolvedInput,
    vectorEffectiveDate: matrix.vectorEffectiveDate,
    featureCount: matrix.featureKeys.length,
    vectors: matrix.vectors,
    kmeans,
    profiles,
  });

  return {
    runId,
    tickerCount: matrix.vectors.length,
    featureCount: matrix.featureKeys.length,
    clusterCount,
    profiles: profiles.map((profile) => ({
      clusterId: profile.clusterId,
      label: profile.label,
      size: profile.size,
      averageCoverageRatio: profile.averageCoverageRatio,
      averageDistanceToCentroid: profile.averageDistanceToCentroid,
      distinguishingFeatures: profile.distinguishingFeatures,
    })),
  };
}

async function loadLatestPositionRows(
  input: ResolvedInput,
): Promise<PositionRow[]> {
  const result = await db.query<PositionRow>(
    `
      SELECT DISTINCT ON (
        p.ticker,
        p.factor,
        p.axis,
        p.metric_key,
        p.signal_key
      )
        p.ticker,
        p.factor,
        p.axis,
        p.metric_key,
        p.signal_key,
        p.signal_value,
        p.percentile,
        p.z_score,
        p.universe_count,
        p.effective_date
      FROM public.ticker_factor_metric_signal_positions p
      WHERE p.factor = $1
        AND p.axis = $2
        AND p.comparison_set_type = $3
        AND p.comparison_set_key = $4
        AND ($5::date IS NULL OR p.effective_date <= $5)
        AND COALESCE(p.universe_count, 0) >= $6
      ORDER BY
        p.ticker,
        p.factor,
        p.axis,
        p.metric_key,
        p.signal_key,
        p.effective_date DESC
    `,
    [
      input.factor,
      input.axis,
      input.comparisonSetType,
      input.comparisonSetKey,
      input.asOfDate ?? null,
      input.minUniverseCount,
    ],
  );

  return result.rows;
}

function buildVectorMatrix(rows: PositionRow[], input: ResolvedInput) {
  const tickerKeys = new Set(rows.map((row) => row.ticker));
  const minFeatureObservations = Math.max(
    1,
    Math.ceil(tickerKeys.size * input.minFeatureCoverageRatio),
  );

  const featureObservationCounts = new Map<string, number>();
  const tickerFeatureValues = new Map<string, Map<string, number>>();
  let vectorEffectiveDate = input.asOfDate ?? rows[0]?.effective_date;

  for (const row of rows) {
    const normalizedValue = normalizePositionValue(row, input.normalizationMethod);
    if (normalizedValue === null) continue;

    vectorEffectiveDate =
      row.effective_date > vectorEffectiveDate ? row.effective_date : vectorEffectiveDate;

    const featureKey = buildFeatureKey(row);
    featureObservationCounts.set(
      featureKey,
      (featureObservationCounts.get(featureKey) ?? 0) + 1,
    );

    const featureValues =
      tickerFeatureValues.get(row.ticker) ?? new Map<string, number>();
    featureValues.set(featureKey, normalizedValue);
    tickerFeatureValues.set(row.ticker, featureValues);
  }

  const featureKeys = [...featureObservationCounts.entries()]
    .filter(([, count]) => count >= minFeatureObservations)
    .map(([featureKey]) => featureKey)
    .sort();

  const vectors: TickerVector[] = [];

  for (const [ticker, featureValues] of tickerFeatureValues.entries()) {
    const values = featureKeys.map((featureKey) => featureValues.get(featureKey) ?? 0);
    const observedFeatureCount = featureKeys.reduce(
      (count, featureKey) => count + (featureValues.has(featureKey) ? 1 : 0),
      0,
    );
    const missingFeatureCount = featureKeys.length - observedFeatureCount;
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

function normalizePositionValue(
  row: PositionRow,
  method: TickerClusterNormalizationMethod,
): number | null {
  if (method === "z_score") return row.z_score;
  if (method === "percentile") {
    return row.percentile === null ? null : row.percentile * 2 - 1;
  }

  const sourceValue = row.z_score ?? row.signal_value;
  if (sourceValue === null) return null;
  if (sourceValue > 0) return 1;
  if (sourceValue < 0) return -1;
  return 0;
}

function buildFeatureKey(row: PositionRow): string {
  return `${row.factor}.${row.axis}.${row.metric_key}.${row.signal_key}`;
}

function runKMeans(
  vectors: number[][],
  clusterCount: number,
  maxIterations: number,
): KMeansResult {
  const centroids = initializeCentroids(vectors, clusterCount);
  let assignments = new Array(vectors.length).fill(-1);

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let changed = false;

    assignments = vectors.map((vector, vectorIndex) => {
      const nextAssignment = closestCentroidIndex(vector, centroids);
      if (nextAssignment !== assignments[vectorIndex]) changed = true;
      return nextAssignment;
    });

    const nextCentroids = recomputeCentroids(vectors, assignments, centroids);
    for (let i = 0; i < centroids.length; i += 1) {
      centroids[i] = nextCentroids[i];
    }

    if (!changed) break;
  }

  return {
    assignments,
    centroids,
    distances: vectors.map((vector, index) =>
      euclideanDistance(vector, centroids[assignments[index]]),
    ),
  };
}

function initializeCentroids(vectors: number[][], clusterCount: number): number[][] {
  const centroids: number[][] = [vectors[0]];

  while (centroids.length < clusterCount) {
    let bestVector = vectors[0];
    let bestDistance = -1;

    for (const vector of vectors) {
      const distance = Math.min(
        ...centroids.map((centroid) => euclideanDistance(vector, centroid)),
      );

      if (distance > bestDistance) {
        bestDistance = distance;
        bestVector = vector;
      }
    }

    centroids.push([...bestVector]);
  }

  return centroids.map((centroid) => [...centroid]);
}

function closestCentroidIndex(vector: number[], centroids: number[][]): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  centroids.forEach((centroid, index) => {
    const distance = euclideanDistance(vector, centroid);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function recomputeCentroids(
  vectors: number[][],
  assignments: number[],
  currentCentroids: number[][],
): number[][] {
  return currentCentroids.map((centroid, clusterIndex) => {
    const members = vectors.filter((_, index) => assignments[index] === clusterIndex);
    if (members.length === 0) return centroid;

    return centroid.map((_, featureIndex) => {
      const sum = members.reduce(
        (total, vector) => total + vector[featureIndex],
        0,
      );
      return sum / members.length;
    });
  });
}

function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;

  for (let i = 0; i < a.length; i += 1) {
    const delta = a[i] - b[i];
    sum += delta * delta;
  }

  return Math.sqrt(sum);
}

function buildClusterProfiles(input: {
  vectors: TickerVector[];
  featureKeys: string[];
  kmeans: KMeansResult;
}): ClusterProfileDraft[] {
  return input.kmeans.centroids
    .map((centroid, clusterId) => {
      const memberIndexes = input.kmeans.assignments
        .map((assignment, index) => (assignment === clusterId ? index : -1))
        .filter((index) => index >= 0);
      const members = memberIndexes.map((index) => input.vectors[index]);
      const distances = memberIndexes.map((index) => input.kmeans.distances[index]);
      const distinguishingFeatures = summarizeCentroidFeatures(
        input.featureKeys,
        centroid,
      );
      const label = buildClusterLabel(clusterId, distinguishingFeatures);

      return {
        clusterId,
        label,
        size: members.length,
        averageCoverageRatio: average(
          members.map((member) => member.coverageRatio),
        ),
        averageDistanceToCentroid:
          distances.length === 0 ? null : average(distances),
        distinguishingFeatures,
        centroid,
      };
    })
    .filter((profile) => profile.size > 0);
}

function summarizeCentroidFeatures(
  featureKeys: string[],
  centroid: number[],
): ClusterFeatureSummary[] {
  return centroid
    .map((value, index) => ({
      featureKey: featureKeys[index],
      value,
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 8)
    .map(({ featureKey, value }) => {
      const parts = featureKey.split(".");
      return {
        featureKey,
        metricKey: parts[2] ?? "",
        signalKey: parts.slice(3).join("."),
        value,
        direction: value >= 0 ? "high" : "low",
      };
    });
}

function buildClusterLabel(
  clusterId: number,
  features: ClusterFeatureSummary[],
): string {
  const strongest = features.slice(0, 3);
  if (strongest.length === 0) return `Cluster ${clusterId}`;

  const traits = strongest.map((feature) => {
    const direction = feature.direction === "high" ? "high" : "low";
    return `${direction} ${feature.metricKey}.${feature.signalKey}`;
  });

  return `Cluster ${clusterId}: ${traits.join(", ")}`;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function buildRunId(input: ResolvedInput): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return [
    "tfm-cluster",
    input.factor,
    input.axis,
    input.comparisonSetType,
    input.comparisonSetKey,
    input.normalizationMethod,
    input.clusterMethod,
    timestamp,
  ].join("__");
}

async function persistClusterRun(input: {
  runId: string;
  input: ResolvedInput;
  vectorEffectiveDate: string;
  featureCount: number;
  vectors: TickerVector[];
  kmeans: KMeansResult;
  profiles: ClusterProfileDraft[];
}) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    for (const profile of input.profiles) {
      await client.query(
        `
          INSERT INTO public.ticker_factor_metric_cluster_profiles (
            run_id,
            cluster_id,
            factor,
            axis,
            comparison_set_type,
            comparison_set_key,
            cluster_method,
            normalization_method,
            cluster_label,
            cluster_size,
            feature_count,
            average_coverage_ratio,
            average_distance_to_centroid,
            distinguishing_features,
            centroid,
            vector_effective_date
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14::jsonb, $15::jsonb, $16
          )
          ON CONFLICT (run_id, cluster_id)
          DO UPDATE SET
            cluster_label = EXCLUDED.cluster_label,
            cluster_size = EXCLUDED.cluster_size,
            feature_count = EXCLUDED.feature_count,
            average_coverage_ratio = EXCLUDED.average_coverage_ratio,
            average_distance_to_centroid = EXCLUDED.average_distance_to_centroid,
            distinguishing_features = EXCLUDED.distinguishing_features,
            centroid = EXCLUDED.centroid,
            computed_at = now()
        `,
        [
          input.runId,
          profile.clusterId,
          input.input.factor,
          input.input.axis,
          input.input.comparisonSetType,
          input.input.comparisonSetKey,
          input.input.clusterMethod,
          input.input.normalizationMethod,
          profile.label,
          profile.size,
          input.featureCount,
          profile.averageCoverageRatio,
          profile.averageDistanceToCentroid,
          JSON.stringify(profile.distinguishingFeatures),
          JSON.stringify(profile.centroid),
          input.vectorEffectiveDate,
        ],
      );
    }

    for (let index = 0; index < input.vectors.length; index += 1) {
      const vector = input.vectors[index];
      const clusterId = input.kmeans.assignments[index];
      const profile = input.profiles.find((item) => item.clusterId === clusterId);

      await client.query(
        `
          INSERT INTO public.ticker_factor_metric_clusters (
            run_id,
            ticker,
            factor,
            axis,
            comparison_set_type,
            comparison_set_key,
            cluster_method,
            normalization_method,
            cluster_id,
            cluster_label,
            cluster_size,
            is_outlier,
            feature_count,
            observed_feature_count,
            missing_feature_count,
            coverage_ratio,
            distance_to_centroid,
            vector_effective_date
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, FALSE, $12, $13, $14, $15, $16, $17
          )
          ON CONFLICT (run_id, ticker)
          DO UPDATE SET
            cluster_id = EXCLUDED.cluster_id,
            cluster_label = EXCLUDED.cluster_label,
            cluster_size = EXCLUDED.cluster_size,
            is_outlier = EXCLUDED.is_outlier,
            feature_count = EXCLUDED.feature_count,
            observed_feature_count = EXCLUDED.observed_feature_count,
            missing_feature_count = EXCLUDED.missing_feature_count,
            coverage_ratio = EXCLUDED.coverage_ratio,
            distance_to_centroid = EXCLUDED.distance_to_centroid,
            computed_at = now()
        `,
        [
          input.runId,
          vector.ticker,
          input.input.factor,
          input.input.axis,
          input.input.comparisonSetType,
          input.input.comparisonSetKey,
          input.input.clusterMethod,
          input.input.normalizationMethod,
          clusterId,
          profile?.label ?? `Cluster ${clusterId}`,
          profile?.size ?? null,
          input.featureCount,
          vector.observedFeatureCount,
          vector.missingFeatureCount,
          vector.coverageRatio,
          input.kmeans.distances[index],
          input.vectorEffectiveDate,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
