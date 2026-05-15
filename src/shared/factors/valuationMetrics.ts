export const VALUATION_METRIC_KEYS = [
  "price_to_diluted_ttm_eps",
  "price_to_basic_ttm_eps",
  "diluted_ttm_eps_growth",
  "basic_ttm_eps_growth",
  "price_to_book",
  "price_to_sales",
  "price_to_earnings",
  "price_to_operating_cash_flow",
  "free_cash_flow_yield",
  "enterprise_value_to_sales",
  "dividend_yield",
  "buyback_yield",
  "shareholder_yield",
  "dividend_yield_share",
  "buyback_yield_share",
  "market_capitalization",
  "log_market_capitalization",
] as const;

export type ValuationMetricKey = (typeof VALUATION_METRIC_KEYS)[number];

const VALUATION_METRIC_KEY_SET = new Set<string>(VALUATION_METRIC_KEYS);

export function isValuationMetricKey(
  value: string,
): value is ValuationMetricKey {
  return VALUATION_METRIC_KEY_SET.has(value);
}
