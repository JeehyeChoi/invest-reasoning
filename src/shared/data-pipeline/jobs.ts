import type { UniverseKey } from "@/shared/universe/universes";

export const DATA_PIPELINE_REFRESH_JOB_KEYS = [
  "universe_memberships_sync",
  "ticker_core_sync",
  "macro_fred_series_sync",
  "ticker_daily_price_history_sync",
  "market_price_factor_features",
  "sec_bulk_ingest",
  "metric_series",
  "series_validation",
  "sec_metric_series_enriched",
  "valuation_metric_series_enriched",
  "factor_metric_features",
  "factor_signals",
  "factor_metric_clustering",
] as const;

export type DataPipelineRefreshJobKey =
  (typeof DATA_PIPELINE_REFRESH_JOB_KEYS)[number];

export const DATA_PIPELINE_REFRESH_JOB_LABELS = {
  universe_memberships_sync: "Universe memberships sync",
  ticker_core_sync: "Company profile & classification sync",
  macro_fred_series_sync: "Macro FRED series sync",
  ticker_daily_price_history_sync: "Ticker daily price history sync",
  market_price_factor_features: "Market price factor features",
  valuation_metric_series_enriched: "Valuation metric enriched series",
  sec_bulk_ingest: "SEC bulk ingest",
  metric_series: "Metric series",
  series_validation: "Series validation",
  sec_metric_series_enriched: "SEC metric enriched series",
  factor_metric_features: "Fundamental & valuation factor features",
  factor_signals: "Factor signals",
  factor_metric_clustering: "Factor signal clustering",
} as const satisfies Record<DataPipelineRefreshJobKey, string>;

export const DATA_PIPELINE_REFRESH_JOB_DESCRIPTIONS = {
  universe_memberships_sync:
    "Syncs selected universe memberships. S&P 500 uses FMP constituents; S&P 400, S&P 600, and DJIA use ETF holdings files. Manual universes such as Factor Proxy ETFs are loaded from stored memberships.",
  ticker_core_sync:
    "Fetches company profiles and classifications for selected universe members or explicitly entered tickers.",
  macro_fred_series_sync:
    "Syncs FRED macro data used by macro comparisons and future macro-aware signal models. Default scheduled run: Monday morning.",
  ticker_daily_price_history_sync:
    "Backfills daily ticker OHLCV history through a replaceable market-data provider slot. Default provider: Twelve Data.",
  market_price_factor_features:
    "Builds market_price axis factor features from stored daily ticker OHLCV history.",
  valuation_metric_series_enriched:
    "Builds valuation metric enriched series by combining stored market prices with SEC per-share and fundamental metrics. This prepares valuation inputs; it does not write factor feature rows.",
  sec_bulk_ingest:
    "Downloads SEC companyfacts bulk data, stages raw/tag rows per CIK, builds fiscal/sign profiles and persistent metric series, then cleans up transient raw/tag rows. Candidate tag statistics are the retained tag-level output.",
  metric_series:
    "Internal/development fallback for building persistent SEC metric series from existing tag rows. Normal startup runs fold this into SEC bulk ingest.",
  series_validation:
    "Checks metric series coverage and continuity. With SEC bulk ingest selected, this runs inside the same per-CIK bulk flow; otherwise it runs as a standalone validation pass.",
  sec_metric_series_enriched:
    "Builds SEC metric enriched series and metric-owned reliability records from cleaned metric series.",
  factor_metric_features:
    "Builds factor-owned fundamental and valuation features from SEC companyfacts enriched series and valuation enriched metrics.",
  factor_signals:
    "Selects factor signals from completed metric features using signal definitions.",
  factor_metric_clustering:
    "Builds clustering outputs from factor signal activation vectors.",
} as const satisfies Record<DataPipelineRefreshJobKey, string>;

export type DataPipelineRebuildMode = "all" | "metric";

export type DataPipelineCompanyScope = "all" | "bulk_changed";

export type DataPipelineUniverseRefreshMode = "skip" | "selected";

export type DataPipelineTickerCoreSyncMode = "skip" | "missing_or_stale";

export type DataPipelineUniverseSelection = {
  universeKeys?: UniverseKey[];
  refreshMode?: DataPipelineUniverseRefreshMode;
};
