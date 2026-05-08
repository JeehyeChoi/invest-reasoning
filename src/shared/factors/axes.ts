export const FACTOR_AXIS_KEYS = [
  "fundamentals_based",
  "market_price",
  "valuation",
  "macro_linked",
  "etf_exposure",
  "narrative_implied",
] as const;

export type FactorAxisKey =
  (typeof FACTOR_AXIS_KEYS)[number];
