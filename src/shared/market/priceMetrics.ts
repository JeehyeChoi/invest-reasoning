export const MARKET_PRICE_METRIC_KEYS = [
  "price",
] as const;

export type MarketPriceMetricKey = (typeof MARKET_PRICE_METRIC_KEYS)[number];

const MARKET_PRICE_METRIC_KEY_SET = new Set<string>(MARKET_PRICE_METRIC_KEYS);

export function isMarketPriceMetricKey(
  value: string,
): value is MarketPriceMetricKey {
  return MARKET_PRICE_METRIC_KEY_SET.has(value);
}
