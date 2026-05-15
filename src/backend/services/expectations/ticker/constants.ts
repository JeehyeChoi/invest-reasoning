export const DEFAULT_PROVIDER = "twelve_data";
export const DEFAULT_ADJUSTMENT_POLICY = "splits";
export const TICKER_EXPECTATION_SOURCE_VERSION =
  "ticker_implied_financial_expectations_v0";

export const EXPECTATION_SOURCE_METRIC_KEYS = [
  "revenue",
  "operating_income",
  "net_income",
  "eps_diluted",
  "shares_outstanding",
  "total_debt",
  "short_term_debt",
  "long_term_debt",
  "cash_and_short_term_investments",
  "cash_and_cash_equivalents",
] as const;
