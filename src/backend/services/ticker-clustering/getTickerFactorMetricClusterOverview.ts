import { db } from "@/backend/config/db";
import type {
  TickerClusterFeatureSummary,
  TickerFactorMetricClusterOverview,
} from "@/shared/market/clusterOverview";

type LatestRunRow = {
  run_id: string;
  factor: string;
  axis: string;
  comparison_set_type: string;
  comparison_set_key: string;
  cluster_method: string;
  normalization_method: string;
  vector_effective_date: Date | string;
  computed_at: Date | string;
  ticker_count: number | string;
  feature_count: number | string;
  cluster_count: number | string;
};

type ProfileRow = {
  cluster_id: number | string;
  cluster_label: string | null;
  cluster_size: number | string;
  feature_count: number | string;
  average_coverage_ratio: number | string;
  average_distance_to_centroid: number | string | null;
  distinguishing_features: TickerClusterFeatureSummary[] | null;
};

type ClusterTickerRow = {
  ticker: string;
  company_name: string | null;
  sector: string | null;
  industry: string | null;
  cluster_id: number | string;
  cluster_label: string | null;
  coverage_ratio: number | string;
  distance_to_centroid: number | string | null;
};

export async function getTickerFactorMetricClusterOverview(): Promise<TickerFactorMetricClusterOverview> {
  try {
    const latestRunResult = await db.query<LatestRunRow>(`
      SELECT
        run_id,
        factor,
        axis,
        comparison_set_type,
        comparison_set_key,
        cluster_method,
        normalization_method,
        vector_effective_date,
        max(computed_at) AS computed_at,
        sum(cluster_size)::integer AS ticker_count,
        max(feature_count)::integer AS feature_count,
        count(*)::integer AS cluster_count
      FROM public.ticker_factor_metric_cluster_profiles
      GROUP BY
        run_id,
        factor,
        axis,
        comparison_set_type,
        comparison_set_key,
        cluster_method,
        normalization_method,
        vector_effective_date
      ORDER BY max(computed_at) DESC
      LIMIT 1
    `);

    const latestRun = latestRunResult.rows[0] ?? null;

    if (!latestRun) {
      return {
        latestRun: null,
        profiles: [],
        clusters: [],
      };
    }

    const [profilesResult, clustersResult] = await Promise.all([
      db.query<ProfileRow>(
        `
          SELECT
            cluster_id,
            cluster_label,
            cluster_size,
            feature_count,
            average_coverage_ratio,
            average_distance_to_centroid,
            distinguishing_features
          FROM public.ticker_factor_metric_cluster_profiles
          WHERE run_id = $1
          ORDER BY cluster_id
        `,
        [latestRun.run_id],
      ),
      db.query<ClusterTickerRow>(
        `
          SELECT
            c.ticker,
            p.company_name,
            tc.sector,
            tc.industry,
            c.cluster_id,
            c.cluster_label,
            c.coverage_ratio,
            c.distance_to_centroid
          FROM public.ticker_factor_metric_clusters c
          LEFT JOIN public.ticker_identities p
            ON p.ticker = c.ticker
          LEFT JOIN public.ticker_company_classifications tc
            ON tc.ticker = c.ticker
          WHERE c.run_id = $1
          ORDER BY c.cluster_id, c.distance_to_centroid NULLS LAST, c.ticker
        `,
        [latestRun.run_id],
      ),
    ]);

    return {
      latestRun: {
        runId: latestRun.run_id,
        factor: latestRun.factor,
        axis: latestRun.axis,
        comparisonSetType: latestRun.comparison_set_type,
        comparisonSetKey: latestRun.comparison_set_key,
        clusterMethod: latestRun.cluster_method,
        normalizationMethod: latestRun.normalization_method,
        vectorEffectiveDate: toDateText(latestRun.vector_effective_date),
        computedAt: toDateTimeText(latestRun.computed_at),
        tickerCount: Number(latestRun.ticker_count),
        featureCount: Number(latestRun.feature_count),
        clusterCount: Number(latestRun.cluster_count),
      },
      profiles: profilesResult.rows.map((row) => ({
        clusterId: Number(row.cluster_id),
        clusterLabel: row.cluster_label,
        clusterSize: Number(row.cluster_size),
        featureCount: Number(row.feature_count),
        averageCoverageRatio: Number(row.average_coverage_ratio),
        averageDistanceToCentroid:
          row.average_distance_to_centroid === null
            ? null
            : Number(row.average_distance_to_centroid),
        distinguishingFeatures: row.distinguishing_features ?? [],
      })),
      clusters: clustersResult.rows.map((row) => ({
        ticker: row.ticker,
        companyName: row.company_name,
        sector: row.sector,
        industry: row.industry,
        clusterId: Number(row.cluster_id),
        clusterLabel: row.cluster_label,
        coverageRatio: Number(row.coverage_ratio),
        distanceToCentroid:
          row.distance_to_centroid === null
            ? null
            : Number(row.distance_to_centroid),
      })),
    };
  } catch (error) {
    if (isUndefinedTableError(error)) {
      return {
        latestRun: null,
        profiles: [],
        clusters: [],
        unavailableReason:
          "Cluster result tables are not created yet. Apply db/ticker_factor_metric_clusters.sql and run clustering.",
      };
    }

    throw error;
  }
}

function isUndefinedTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "42P01"
  );
}

function toDateText(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function toDateTimeText(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}
