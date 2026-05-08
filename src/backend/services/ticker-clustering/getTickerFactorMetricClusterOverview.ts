import { db } from "@/backend/config/db";
import type {
  TickerClusterCategoryStat,
  TickerClusterFeatureSummary,
  TickerFactorMetricClusterOverview,
  TickerFactorMetricClusterOverviewRun,
} from "@/shared/market/clusterOverview";

type LatestRunRow = {
  run_id: string;
  factor: string;
  axis: string;
  comparison_set_type: string;
  comparison_set_key: string;
  cluster_method: string;
  normalization_method: string;
  vector_mode: string;
  vector_source_policy: string;
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
  market_cap: number | string | null;
  cluster_id: number | string;
  cluster_label: string | null;
  coverage_ratio: number | string;
  distance_to_centroid: number | string | null;
};

export type GetTickerFactorMetricClusterOverviewInput = {
  runId?: string;
  factor?: string;
  axis?: string;
  normalizationMethod?: string;
  vectorMode?: string;
  vectorSourcePolicy?: string;
  runScope?: "single" | "combined" | "all";
};

export async function getTickerFactorMetricClusterOverview(
  input: GetTickerFactorMetricClusterOverviewInput = {},
): Promise<TickerFactorMetricClusterOverview> {
  try {
    const [availableRunsResult, latestRunResult] = await Promise.all([
      loadAvailableRuns(input),
      loadSelectedRun(input),
    ]);

    const latestRun = latestRunResult;
    const availableRuns = availableRunsResult.map(mapRunRow);

    if (!latestRun) {
      return {
        availableRuns,
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
          FROM public.ticker_factor_feature_cluster_profiles
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
            m.market_cap,
            c.cluster_id,
            c.cluster_label,
            c.coverage_ratio,
            c.distance_to_centroid
          FROM public.ticker_factor_feature_clusters c
          LEFT JOIN public.ticker_identities p
            ON p.ticker = c.ticker
          LEFT JOIN public.ticker_company_classifications tc
            ON tc.ticker = c.ticker
          LEFT JOIN public.ticker_market_snapshots m
            ON m.ticker = c.ticker
          WHERE c.run_id = $1
          ORDER BY
            c.cluster_id,
            m.market_cap DESC NULLS LAST,
            c.distance_to_centroid NULLS LAST,
            c.ticker
        `,
        [latestRun.run_id],
      ),
    ]);

    const categoryStatsByCluster = buildCategoryStatsByCluster(
      clustersResult.rows,
    );

    return {
      availableRuns,
      latestRun: mapRunRow(latestRun),
      profiles: profilesResult.rows.map((row) => {
        const clusterId = Number(row.cluster_id);
        const categoryStats = categoryStatsByCluster.get(clusterId);

        return {
          clusterId,
          clusterLabel: row.cluster_label,
          clusterSize: Number(row.cluster_size),
          featureCount: Number(row.feature_count),
          averageCoverageRatio: Number(row.average_coverage_ratio),
          averageDistanceToCentroid: toNullableNumber(
            row.average_distance_to_centroid,
          ),
          sectorStats: categoryStats?.sectorStats ?? [],
          industryStats: categoryStats?.industryStats ?? [],
          distinguishingFeatures: row.distinguishing_features ?? [],
        };
      }),
      clusters: clustersResult.rows.map((row) => ({
        ticker: row.ticker,
        companyName: row.company_name,
        sector: row.sector,
        industry: row.industry,
        marketCap: toNullableNumber(row.market_cap),
        clusterId: Number(row.cluster_id),
        clusterLabel: row.cluster_label,
        coverageRatio: Number(row.coverage_ratio),
        distanceToCentroid: toNullableNumber(row.distance_to_centroid),
      })),
    };
  } catch (error) {
    if (isUndefinedTableError(error)) {
      return {
        availableRuns: [],
        latestRun: null,
        profiles: [],
        clusters: [],
        unavailableReason:
          "Cluster result tables are not created yet. Apply db/ticker_factor_feature_clusters.sql and run clustering.",
      };
    }

    throw error;
  }
}

async function loadAvailableRuns(
  input: GetTickerFactorMetricClusterOverviewInput,
): Promise<LatestRunRow[]> {
  const filter = buildRunFilter(input, { defaultRunScope: "single" });
  const result = await db.query<LatestRunRow>(
    `
        WITH runs AS (
          SELECT
            run_id,
            factor,
            axis,
            comparison_set_type,
            comparison_set_key,
            cluster_method,
            normalization_method,
            vector_mode,
            vector_source_policy,
            vector_effective_date,
            max(computed_at) AS computed_at,
            sum(cluster_size)::integer AS ticker_count,
            max(feature_count)::integer AS feature_count,
            count(*)::integer AS cluster_count
          FROM public.ticker_factor_feature_cluster_profiles
          ${filter.whereSql}
          GROUP BY
            run_id,
            factor,
            axis,
            comparison_set_type,
            comparison_set_key,
            cluster_method,
            normalization_method,
            vector_mode,
            vector_source_policy,
            vector_effective_date
        )
        SELECT DISTINCT ON (factor, axis)
          run_id,
          factor,
          axis,
          comparison_set_type,
          comparison_set_key,
          cluster_method,
          normalization_method,
          vector_mode,
          vector_source_policy,
          vector_effective_date,
          computed_at,
          ticker_count,
          feature_count,
          cluster_count
        FROM runs
        ORDER BY factor ASC, axis ASC, computed_at DESC
      `,
    filter.params,
  );

  return result.rows;
}

async function loadSelectedRun(
  input: GetTickerFactorMetricClusterOverviewInput,
): Promise<LatestRunRow | null> {
  const baseSelect = `
    SELECT
      run_id,
      factor,
      axis,
      comparison_set_type,
      comparison_set_key,
      cluster_method,
      normalization_method,
      vector_mode,
      vector_source_policy,
      vector_effective_date,
      max(computed_at) AS computed_at,
      sum(cluster_size)::integer AS ticker_count,
      max(feature_count)::integer AS feature_count,
      count(*)::integer AS cluster_count
    FROM public.ticker_factor_feature_cluster_profiles
  `;
  const groupAndOrder = `
    GROUP BY
      run_id,
      factor,
      axis,
      comparison_set_type,
      comparison_set_key,
      cluster_method,
      normalization_method,
      vector_mode,
      vector_source_policy,
      vector_effective_date
    ORDER BY max(computed_at) DESC
    LIMIT 1
  `;

  if (input.runId) {
    const result = await db.query<LatestRunRow>(
      `${baseSelect} WHERE run_id = $1 ${groupAndOrder}`,
      [input.runId],
    );
    return result.rows[0] ?? null;
  }

  const filter = buildRunFilter(input, { defaultRunScope: "all" });
  const result = await db.query<LatestRunRow>(
    `${baseSelect} ${filter.whereSql} ${groupAndOrder}`,
    filter.params,
  );
  return result.rows[0] ?? null;
}

function mapRunRow(row: LatestRunRow): TickerFactorMetricClusterOverviewRun {
  return {
    runId: row.run_id,
    factor: row.factor,
    axis: row.axis,
    comparisonSetType: row.comparison_set_type,
    comparisonSetKey: row.comparison_set_key,
    clusterMethod: row.cluster_method,
    normalizationMethod: row.normalization_method,
    vectorMode: row.vector_mode,
    vectorSourcePolicy: row.vector_source_policy,
    vectorEffectiveDate: toDateText(row.vector_effective_date),
    computedAt: toDateTimeText(row.computed_at),
    tickerCount: Number(row.ticker_count),
    featureCount: Number(row.feature_count),
    clusterCount: Number(row.cluster_count),
  };
}

function buildRunFilter(
  input: GetTickerFactorMetricClusterOverviewInput,
  options: { defaultRunScope: "single" | "combined" | "all" },
) {
  const clauses: string[] = [];
  const params: string[] = [];
  const runScope = input.runScope ?? options.defaultRunScope;

  if (input.factor) {
    params.push(input.factor);
    clauses.push(`factor = $${params.length}`);
  }

  if (input.axis) {
    params.push(input.axis);
    clauses.push(`axis = $${params.length}`);
  }

  if (input.normalizationMethod) {
    params.push(input.normalizationMethod);
    clauses.push(`normalization_method = $${params.length}`);
  }

  if (input.vectorMode) {
    params.push(input.vectorMode);
    clauses.push(`vector_mode = $${params.length}`);
  }

  if (input.vectorSourcePolicy) {
    params.push(input.vectorSourcePolicy);
    clauses.push(`vector_source_policy = $${params.length}`);
  }

  if (runScope === "single") {
    clauses.push("factor NOT LIKE '%+%'");
    clauses.push("axis NOT LIKE '%+%'");
  } else if (runScope === "combined") {
    clauses.push("(factor LIKE '%+%' OR axis LIKE '%+%')");
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params,
  };
}

function buildCategoryStatsByCluster(rows: ClusterTickerRow[]) {
  const grouped = new Map<
    number,
    {
      sectorCounts: Map<string, number>;
      industryCounts: Map<string, number>;
      total: number;
    }
  >();

  for (const row of rows) {
    const clusterId = Number(row.cluster_id);
    const group =
      grouped.get(clusterId) ??
      {
        sectorCounts: new Map<string, number>(),
        industryCounts: new Map<string, number>(),
        total: 0,
      };

    group.total += 1;
    incrementCount(group.sectorCounts, row.sector ?? "Unclassified");
    incrementCount(group.industryCounts, row.industry ?? "Unclassified");
    grouped.set(clusterId, group);
  }

  return new Map(
    [...grouped.entries()].map(([clusterId, group]) => [
      clusterId,
      {
        sectorStats: toCategoryStats(group.sectorCounts, group.total, 5),
        industryStats: toCategoryStats(group.industryCounts, group.total, 6),
      },
    ]),
  );
}

function incrementCount(counts: Map<string, number>, name: string) {
  const normalizedName = name.trim() === "" ? "Unclassified" : name;
  counts.set(normalizedName, (counts.get(normalizedName) ?? 0) + 1);
}

function toCategoryStats(
  counts: Map<string, number>,
  total: number,
  limit: number,
): TickerClusterCategoryStat[] {
  if (total === 0) return [];

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({
      name,
      count,
      share: count / total,
    }));
}

function isUndefinedTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "42P01"
  );
}

function toNullableNumber(value: number | string | null): number | null {
  return value === null ? null : Number(value);
}

function toDateText(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function toDateTimeText(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  return value;
}
