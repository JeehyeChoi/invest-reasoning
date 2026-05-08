import { db } from "@/backend/config/db";
import { buildTickerVectorMatrix } from "@/backend/services/ticker-vectorization/buildTickerVectorMatrix";
import type {
  TickerVector,
  TickerVectorMode,
  TickerVectorNormalizationMethod,
  TickerVectorSourcePolicy,
  TickerVectorTarget,
} from "@/backend/services/ticker-vectorization/types";
import type { FactorKey } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";

export type TickerClusterMethod = "kmeans";
export type TickerClusterNormalizationMethod = TickerVectorNormalizationMethod;
export type TickerClusterVectorMode = TickerVectorMode;
export type TickerClusterVectorSourcePolicy = TickerVectorSourcePolicy;
export type TickerClusterTarget = TickerVectorTarget;

export type RunTickerFactorMetricClusteringInput = {
  factor?: FactorKey;
  axis?: FactorAxisKey;
  targets?: TickerClusterTarget[];
  comparisonSetType?: string;
  comparisonSetKey?: string;
  asOfDate?: string;
  normalizationMethod?: TickerClusterNormalizationMethod;
  vectorMode?: TickerClusterVectorMode;
  vectorSourcePolicy?: TickerClusterVectorSourcePolicy;
  runScope?: "single" | "combined" | "both";
  clusterMethod?: TickerClusterMethod;
  clusterCount?: number;
  maxIterations?: number;
  minTickerCoverageRatio?: number;
  minFeatureCoverageRatio?: number;
  minUniverseCount?: number;
  zScoreClip?: number;
  onProgress?: (progress: {
    message: string;
    current?: number;
    total?: number;
    label?: string;
  }) => void;
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
    | "comparisonSetType"
    | "comparisonSetKey"
    | "normalizationMethod"
    | "vectorMode"
    | "vectorSourcePolicy"
    | "clusterMethod"
    | "maxIterations"
    | "minTickerCoverageRatio"
    | "minFeatureCoverageRatio"
    | "minUniverseCount"
    | "zScoreClip"
  >
> &
  Pick<RunTickerFactorMetricClusteringInput, "asOfDate" | "clusterCount"> & {
    factor: string;
    axis: string;
    targets: TickerClusterTarget[];
  };

type KMeansResult = {
  assignments: number[];
  centroids: number[][];
  distances: number[];
};

type ClusterFeatureSummary = {
  factorKey: string;
  axisKey: string;
  metricKey: string;
  featureKey: string;
  value: number;
  direction: "high" | "low";
};

type ClusterProfileDraft = TickerFactorMetricClusterProfile & {
  centroid: number[];
};

function resolveInput(
  input: RunTickerFactorMetricClusteringInput,
): ResolvedInput {
  const targets =
    input.targets && input.targets.length > 0
      ? input.targets
      : [
          {
            factor: input.factor ?? "growth",
            axis: input.axis ?? "fundamentals_based",
          },
        ];
  const uniqueTargets = dedupeTargets(targets);

  return {
    factor:
      uniqueTargets.length === 1
        ? uniqueTargets[0].factor
        : uniqueTargets.map((target) => target.factor).join("+"),
    axis:
      uniqueTargets.length === 1
        ? uniqueTargets[0].axis
        : dedupeValues(uniqueTargets.map((target) => target.axis)).join("+"),
    targets: uniqueTargets,
    comparisonSetType: input.comparisonSetType ?? "us_public_equities",
    comparisonSetKey: input.comparisonSetKey ?? "all",
    asOfDate: input.asOfDate,
    vectorMode: input.vectorMode ?? "factor_signal",
    vectorSourcePolicy: input.vectorSourcePolicy ?? "signal_activation",
    normalizationMethod: input.normalizationMethod ?? "none",
    clusterMethod: input.clusterMethod ?? "kmeans",
    clusterCount: input.clusterCount,
    maxIterations: input.maxIterations ?? 100,
    minTickerCoverageRatio: input.minTickerCoverageRatio ?? 0.45,
    minFeatureCoverageRatio: input.minFeatureCoverageRatio ?? 0.35,
    minUniverseCount: input.minUniverseCount ?? 25,
    zScoreClip: input.zScoreClip ?? 3,
  };
}

function dedupeTargets(targets: TickerClusterTarget[]): TickerClusterTarget[] {
  const seen = new Set<string>();
  const uniqueTargets: TickerClusterTarget[] = [];

  for (const target of targets) {
    const key = `${target.factor}.${target.axis}`;
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueTargets.push(target);
  }

  return uniqueTargets;
}

function dedupeValues(values: string[]): string[] {
  return [...new Set(values)];
}

export async function runTickerFactorMetricClustering(
  input: RunTickerFactorMetricClusteringInput = {},
): Promise<RunTickerFactorMetricClusteringResult> {
  const resolvedInput = resolveInput(input);

  input.onProgress?.({
    message: `Factor metric clustering building ${resolvedInput.vectorMode}/${resolvedInput.vectorSourcePolicy} vectors.`,
    current: 1,
    total: 5,
    label: "vectors",
  });
  const matrix = await buildTickerVectorMatrix(resolvedInput);

  if (matrix.vectors.length === 0 || matrix.featureKeys.length === 0) {
    throw new Error("No ticker vectors available for clustering.");
  }

  input.onProgress?.({
    message: `Factor metric clustering resolving cluster count. tickers=${matrix.vectors.length}, features=${matrix.featureKeys.length}.`,
    current: 2,
    total: 5,
    label: "cluster-count",
  });

  const shouldGroupSignalCohorts =
    resolvedInput.vectorMode === "factor_signal" &&
    resolvedInput.targets.length === 1 &&
    resolvedInput.clusterCount === undefined;
  const clusterCount = shouldGroupSignalCohorts
    ? countUniqueVectors(matrix.vectors.map((vector) => vector.values))
    : resolveClusterCount({
        vectors: matrix.vectors.map((vector) => vector.values),
        requestedClusterCount: resolvedInput.clusterCount,
        maxIterations: resolvedInput.maxIterations,
      });

  input.onProgress?.({
    message: shouldGroupSignalCohorts
      ? `Factor metric clustering grouping signal cohorts. groups=${clusterCount}.`
      : `Factor metric clustering running k-means. clusters=${clusterCount}.`,
    current: 3,
    total: 5,
    label: shouldGroupSignalCohorts ? "signal-cohorts" : "kmeans",
  });

  const kmeans = shouldGroupSignalCohorts
    ? groupIdenticalVectors(matrix.vectors)
    : runKMeans(
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

  input.onProgress?.({
    message: `Factor metric clustering persisting run ${runId}.`,
    current: 4,
    total: 5,
    label: "persist",
  });

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
    clusterCount: profiles.length,
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

function resolveClusterCount(input: {
  vectors: number[][];
  requestedClusterCount?: number;
  maxIterations: number;
}): number {
  const uniqueVectorCount = countUniqueVectors(input.vectors);

  if (input.requestedClusterCount !== undefined) {
    return Math.max(
      1,
      Math.min(input.requestedClusterCount, input.vectors.length, uniqueVectorCount),
    );
  }

  return chooseClusterCountBySilhouette({
    vectors: input.vectors,
    maxIterations: input.maxIterations,
    maxClusterCount: uniqueVectorCount,
  });
}

function chooseClusterCountBySilhouette(input: {
  vectors: number[][];
  maxIterations: number;
  maxClusterCount: number;
}): number {
  if (input.vectors.length <= 2 || input.maxClusterCount <= 1) return 1;

  const maxCandidate = Math.max(
    2,
    Math.min(
      input.vectors.length - 1,
      input.maxClusterCount,
      Math.floor(Math.sqrt(input.vectors.length)),
    ),
  );
  let bestClusterCount = 2;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let clusterCount = 2; clusterCount <= maxCandidate; clusterCount += 1) {
    const kmeans = runKMeans(input.vectors, clusterCount, input.maxIterations);
    const score = clusterUsefulnessScore({
      vectors: input.vectors,
      assignments: kmeans.assignments,
      clusterCount,
    });

    if (score > bestScore) {
      bestScore = score;
      bestClusterCount = clusterCount;
    }
  }

  return bestClusterCount;
}

function countUniqueVectors(vectors: number[][]): number {
  return new Set(vectors.map((vector) => vector.join("|"))).size;
}

function groupIdenticalVectors(vectors: TickerVector[]): KMeansResult {
  const keyToClusterId = new Map<string, number>();
  const centroids: number[][] = [];
  const assignments = vectors.map((vector) => {
    const key = vector.values.join("|");
    const existingClusterId = keyToClusterId.get(key);

    if (existingClusterId !== undefined) return existingClusterId;

    const clusterId = keyToClusterId.size;
    keyToClusterId.set(key, clusterId);
    centroids.push([...vector.values]);
    return clusterId;
  });

  return {
    assignments,
    centroids,
    distances: vectors.map(() => 0),
  };
}

function clusterUsefulnessScore(input: {
  vectors: number[][];
  assignments: number[];
  clusterCount: number;
}): number {
  const silhouette = averageSilhouetteScore(input.vectors, input.assignments);
  const clusterSizes = countClusterSizes(input.assignments);
  const smallestShare = Math.min(...clusterSizes) / input.vectors.length;
  const smallestSize = Math.min(...clusterSizes);
  const tinyClusterPenalty = clusterSizes
    .filter((size) => size < 10 || size / input.vectors.length < 0.025)
    .length * 0.25;

  // Pure silhouette usually collapses market structure into a binary split.
  // This keeps K automatic while preferring useful segmentation when quality is close.
  const granularityBonus =
    Math.log(input.clusterCount) * 0.1 - input.clusterCount * 0.012;
  const balancePenalty =
    smallestSize < 5 ? 0.55 : smallestShare < 0.01 ? 0.25 : 0;

  return silhouette + granularityBonus - tinyClusterPenalty - balancePenalty;
}

function countClusterSizes(assignments: number[]): number[] {
  const counts = new Map<number, number>();

  for (const assignment of assignments) {
    counts.set(assignment, (counts.get(assignment) ?? 0) + 1);
  }

  return [...counts.values()];
}

function averageSilhouetteScore(
  vectors: number[][],
  assignments: number[],
): number {
  const clusterIndexes = new Map<number, number[]>();

  assignments.forEach((assignment, index) => {
    const indexes = clusterIndexes.get(assignment) ?? [];
    indexes.push(index);
    clusterIndexes.set(assignment, indexes);
  });

  const scores = vectors.map((vector, index) => {
    const ownCluster = assignments[index];
    const ownIndexes = clusterIndexes.get(ownCluster) ?? [];
    const averageOwnDistance =
      ownIndexes.length <= 1
        ? 0
        : average(
            ownIndexes
              .filter((memberIndex) => memberIndex !== index)
              .map((memberIndex) => euclideanDistance(vector, vectors[memberIndex])),
          );

    const nearestOtherDistance = Math.min(
      ...[...clusterIndexes.entries()]
        .filter(([clusterId]) => clusterId !== ownCluster)
        .map(([, memberIndexes]) =>
          average(
            memberIndexes.map((memberIndex) =>
              euclideanDistance(vector, vectors[memberIndex]),
            ),
          ),
        ),
    );

    if (!Number.isFinite(nearestOtherDistance)) return 0;

    const denominator = Math.max(averageOwnDistance, nearestOtherDistance);
    if (denominator === 0) return 0;

    return (nearestOtherDistance - averageOwnDistance) / denominator;
  });

  return average(scores);
}

function initializeCentroids(vectors: number[][], clusterCount: number): number[][] {
  const rankedVectors = [...vectors].sort(
    (a, b) => vectorScore(a) - vectorScore(b),
  );

  if (clusterCount === 1) {
    return [[...rankedVectors[Math.floor(rankedVectors.length / 2)]]];
  }

  return Array.from({ length: clusterCount }, (_, index) => {
    const percentile = (index + 0.5) / clusterCount;
    const vectorIndex = Math.min(
      rankedVectors.length - 1,
      Math.max(0, Math.floor(percentile * rankedVectors.length)),
    );
    return [...rankedVectors[vectorIndex]];
  });
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

function vectorScore(vector: number[]): number {
  return vector.reduce((total, value) => total + value, 0) / vector.length;
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
    .map(({ featureKey, value }) => {
      const parts = featureKey.split(".");
      return {
        factorKey: parts[0] ?? "",
        axisKey: parts[1] ?? "",
        metricKey: parts[2] ?? "",
        featureKey: parts.slice(3).join("."),
        value,
        direction: value > 0 ? "high" : "low",
      };
    });
}

function buildClusterLabel(
  clusterId: number,
  features: ClusterFeatureSummary[],
): string {
  const strongest = features.slice(0, 3);
  const activeTraits = strongest.filter((feature) => Math.abs(feature.value) > 0);
  if (activeTraits.length === 0) return `Cluster ${clusterId}`;

  const traits = activeTraits.map((feature) => {
    return `${formatLabel(feature.metricKey)} ${formatLabel(feature.featureKey)} ${feature.direction}`;
  });

  return `Cluster ${clusterId}: ${traits.join(", ")}`;
}

function formatLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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
    input.vectorMode,
    input.vectorSourcePolicy,
    input.normalizationMethod,
    input.clusterMethod,
    input.clusterCount === undefined ? "auto" : `k${input.clusterCount}`,
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
          INSERT INTO public.ticker_factor_feature_cluster_profiles (
            run_id,
            cluster_id,
            factor,
            axis,
            comparison_set_type,
            comparison_set_key,
            cluster_method,
            normalization_method,
            vector_mode,
            vector_source_policy,
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
            $11, $12, $13, $14, $15, $16::jsonb, $17::jsonb, $18
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
          input.input.vectorMode,
          input.input.vectorSourcePolicy,
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
          INSERT INTO public.ticker_factor_feature_clusters (
            run_id,
            ticker,
            factor,
            axis,
            comparison_set_type,
            comparison_set_key,
            cluster_method,
            normalization_method,
            vector_mode,
            vector_source_policy,
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
            $11, $12, $13, FALSE, $14, $15, $16, $17, $18, $19
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
          input.input.vectorMode,
          input.input.vectorSourcePolicy,
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
