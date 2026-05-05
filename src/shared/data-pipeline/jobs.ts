import type { UniverseKey } from "@/shared/universe/universes";

export const DATA_PIPELINE_REFRESH_JOB_KEYS = [
  "macro_fred_series_sync",
  "sec_bulk_ingest",
  "fiscal_profile",
  "metric_series",
  "series_validation",
  "factor_metric_features",
  "factor_signals",
  "factor_metric_clustering",
] as const;

export type DataPipelineRefreshJobKey =
  (typeof DATA_PIPELINE_REFRESH_JOB_KEYS)[number];

export const DATA_PIPELINE_REFRESH_JOB_LABELS = {
  macro_fred_series_sync: "Macro FRED series sync",
  sec_bulk_ingest: "SEC bulk ingest",
  fiscal_profile: "Fiscal profile",
  metric_series: "Metric series",
  series_validation: "Series validation",
  factor_metric_features: "Factor metric features",
  factor_signals: "Factor signals",
  factor_metric_clustering: "Factor metric clustering",
} as const satisfies Record<DataPipelineRefreshJobKey, string>;

export const DATA_PIPELINE_REFRESH_JOB_DESCRIPTIONS = {
  macro_fred_series_sync:
    "Syncs FRED macro data used by macro comparisons and future macro-aware signal models. Default scheduled run: Monday morning.",
  sec_bulk_ingest:
    "Downloads SEC companyfacts bulk data, builds per-company tag series, and cleans up raw rows. Company Scope controls full reread vs changed-file ingest.",
  fiscal_profile: "Builds company fiscal profiles.",
  metric_series:
    "Builds cleaned metric series, enriched series, and metric-owned reliability records.",
  series_validation: "Checks metric series coverage and continuity.",
  factor_metric_features:
    "Builds factor-owned metric features and feature comparison outputs.",
  factor_signals:
    "Selects factor signals from completed metric features using signal definitions.",
  factor_metric_clustering:
    "Builds clustering outputs from metric feature positions.",
} as const satisfies Record<DataPipelineRefreshJobKey, string>;

export type DataPipelineRebuildMode = "all" | "metric";

export type DataPipelineCompanyScope = "all" | "bulk_changed";

export type DataPipelineUniverseRefreshMode = "skip" | "selected";

export type DataPipelineTickerCoreSyncMode = "skip" | "missing_or_stale";

export type DataPipelineUniverseSelection = {
  universeKeys?: UniverseKey[];
  refreshMode?: DataPipelineUniverseRefreshMode;
};
