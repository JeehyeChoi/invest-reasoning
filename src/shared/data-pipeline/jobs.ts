import type { UniverseKey } from "@/shared/universe/universes";

export const DATA_PIPELINE_REFRESH_JOB_KEYS = [
  "sec_bulk_ingest",
  "fiscal_profile",
  "tag_series",
  "metric_series",
  "series_validation",
  "factor_metric_signals",
  "factor_metric_clustering",
] as const;

export type DataPipelineRefreshJobKey =
  (typeof DATA_PIPELINE_REFRESH_JOB_KEYS)[number];

export type DataPipelineRebuildMode = "all" | "metric";

export type DataPipelineCompanyScope = "all" | "bulk_changed";

export type DataPipelineUniverseRefreshMode = "skip" | "selected";

export type DataPipelineTickerCoreSyncMode = "skip" | "missing_or_stale";

export type DataPipelineUniverseSelection = {
  universeKeys?: UniverseKey[];
  refreshMode?: DataPipelineUniverseRefreshMode;
};
