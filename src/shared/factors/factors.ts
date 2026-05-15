/**
 * Source of truth:
 * - factor keys: scripts/bootstrap/factors/factor-definitions.json
 * - factor axes: src/shared/factors/axes.ts
 * - metric feature storage: db/ticker_factor_metric_features.sql
 * - factor feature definition storage: db/ticker_factor_feature_definitions.sql
 * - factor metric display definition storage: db/ticker_factor_metric_display_definitions.sql
 * - factor axis display definition storage: db/ticker_factor_axis_display_definitions.sql
 * - factor signal definition storage: db/ticker_factor_signal_definitions.sql
 * - factor signal result storage: db/ticker_factor_signals.sql
 */

export const FACTOR_KEYS = [
  "consumer_linked",
  "capex_cycle",
  "rate_sensitive",
  "credit_sensitive",
  "energy_linked",
  "china_exposure",
  "quality",
  "income",
  "size",
  "momentum",
  "high_beta",
  "low_volatility",
  "defensive",
  "duration_sensitive",
  "liquidity_sensitive",
  "inflation_hedge",
  "commodity_linked",
  "reshoring_defense",
  "growth",
  "value",
  "cyclical",
] as const;

export type FactorKey = (typeof FACTOR_KEYS)[number];

export const FACTOR_METRIC_ROLES = [
  "core",
  "supporting",
  "context",
] as const;

export type FactorMetricRole = (typeof FACTOR_METRIC_ROLES)[number];
