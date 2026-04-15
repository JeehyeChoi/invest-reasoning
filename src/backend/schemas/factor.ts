// src/backend/schemas/factor.ts

/**
 * Source of truth:
 * - factor keys: scripts/data/factor-definitions.json
 * - factor score axes: db/factor_score_axis_definitions.sql
 * - snapshot storage: db/ticker_factor_score_snapshots.sql
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

export const FACTOR_SCORE_AXIS_KEYS = [
  "fundamentals_based",
  "etf_implied",
  "narrative_implied",
] as const;

export type FactorScoreAxisKey = (typeof FACTOR_SCORE_AXIS_KEYS)[number];

/**
 * Row shape for ticker_factor_score_snapshots
 *
 * Keep this limited to fields already established in DB.
 * Do not add scoring engine input/output abstractions yet.
 */
export type TickerFactorScoreSnapshotRow = {
  snapshot_date: string;
  ticker: string;
  factor_key: FactorKey;
  axis_key: FactorScoreAxisKey;
  score: number;
  confidence: number;
  source_note: string | null;
};
