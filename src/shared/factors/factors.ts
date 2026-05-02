/**
 * Source of truth:
 * - factor keys: scripts/bootstrap/factors/factor-definitions.json
 * - factor axes: src/shared/factors/axes.ts
 * - metric signal storage: db/ticker_factor_metric_signals.sql
 * - metric baseline storage: db/ticker_factor_metric_baselines.sql
 * - metric relative-position storage: db/ticker_factor_metric_signal_positions.sql
 */

export const FACTOR_KEYS = [
  "consumer_strength",
  "capex_cycle",
  "rate_sensitive",
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
