import type { UniverseKey } from "@/shared/universe/universes";

export const DATA_PIPELINE_REFRESH_JOB_KEYS = [
  "universe_memberships_sync",
  "ticker_core_sync",
  "macro_fred_series_sync",
  "ticker_daily_price_history_sync",
  "sec_bulk_ingest",
  "metric_series",
  "sec_metric_series_experiment",
  "series_validation",
  "sec_metric_series_enriched",
  "derived_metric_series",
  "ticker_implied_financial_expectations",
  "fundamentals_based_factor_features",
  "valuation_factor_features",
  "market_price_factor_features",
  "etf_exposure_factor_features",
  "macro_linked_factor_features",
  "factor_signals",
  "signal_percolation_timeline",
] as const;

export type DataPipelineRefreshJobKey =
  (typeof DATA_PIPELINE_REFRESH_JOB_KEYS)[number];

export const DATA_PIPELINE_REFRESH_JOB_LABELS = {
  universe_memberships_sync: "Universe memberships sync",
  ticker_core_sync: "Company profile & classification sync",
  macro_fred_series_sync: "Macro FRED series sync",
  ticker_daily_price_history_sync: "Ticker daily price history sync",
  derived_metric_series: "Derived metric series",
  ticker_implied_financial_expectations:
    "Ticker implied financial expectations",
  sec_bulk_ingest: "SEC bulk ingest",
  metric_series: "Metric series",
  sec_metric_series_experiment: "SEC metric series experiment",
  series_validation: "Series validation",
  sec_metric_series_enriched: "SEC metric enriched series",
  fundamentals_based_factor_features: "Fundamentals axis factor features",
  valuation_factor_features: "Valuation axis factor features",
  market_price_factor_features: "Market price axis factor features",
  etf_exposure_factor_features: "ETF exposure axis factor features",
  macro_linked_factor_features: "Macro linked axis factor features",
  factor_signals: "Factor signals",
  signal_percolation_timeline: "Signal percolation timeline",
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
  derived_metric_series:
    "Builds reusable derived metric series from SEC enriched series, price history, and macro observations. By default this runs quarter-end timeline snapshots across the available 30-year market-data window when no as-of date is supplied.",
  ticker_implied_financial_expectations:
    "Builds scenario-based implied revenue, earnings, EPS, and burden rows from current ticker valuation and TTM financials.",
  sec_bulk_ingest:
    "Downloads SEC companyfacts bulk data, stages raw/tag rows per CIK, builds fiscal/sign profiles and persistent metric series, then cleans up transient raw/tag rows. Candidate tag statistics are the retained tag-level output.",
  metric_series:
    "Internal/development fallback for building persistent SEC metric series from existing tag rows. Normal startup runs fold this into SEC bulk ingest.",
  sec_metric_series_experiment:
    "Builds candidate-stats-driven experimental SEC metric series into sec_companyfact_metric_series_experiment for a capped subset of CIKs.",
  series_validation:
    "Checks metric series coverage and continuity. With SEC bulk ingest selected, this runs inside the same per-CIK bulk flow; otherwise it runs as a standalone validation pass.",
  sec_metric_series_enriched:
    "Builds SEC metric enriched series and metric-owned reliability records from cleaned metric series.",
  fundamentals_based_factor_features:
    "Builds fundamentals_based axis factor features from SEC companyfacts enriched series.",
  valuation_factor_features:
    "Builds valuation axis feature rows from ticker_derived_metric_series. By default this reads quarter-end timeline snapshots across the available 30-year market-data window when no as-of date is supplied.",
  market_price_factor_features:
    "Builds market_price axis factor features from stored daily ticker OHLCV history and benchmark or macro observations. By default this runs quarter-end timeline snapshots across the available 30-year market-data window when no as-of date is supplied.",
  etf_exposure_factor_features:
    "Builds etf_exposure axis factor features from stored daily ticker OHLCV history and factor proxy ETF return baskets. By default this runs quarter-end timeline snapshots across the available 30-year market-data window when no as-of date is supplied.",
  macro_linked_factor_features:
    "Builds macro_linked axis factor features by aligning SEC enriched quarterly company series with stored FRED macro observations.",
  factor_signals:
    "Selects factor signals from completed metric features using signal definitions. By default this runs quarter-end timeline snapshots across the available 30-year market-data window when no as-of date is supplied.",
  signal_percolation_timeline:
    "Builds quarter-end market signal network timeline snapshots from selected factor signals. Choose only the axis lenses you want to calculate.",
} as const satisfies Record<DataPipelineRefreshJobKey, string>;

export type DataPipelineRebuildMode = "all" | "metric";

export type DataPipelineCompanyScope = "all" | "bulk_changed";

export type DataPipelineUniverseRefreshMode = "skip" | "selected";

export type DataPipelineTickerCoreSyncMode = "skip" | "missing_or_stale";

export type DataPipelineUniverseSelection = {
  universeKeys?: UniverseKey[];
  refreshMode?: DataPipelineUniverseRefreshMode;
};
