// backend/services/market/getPrices.ts

import { ENV } from "@/backend/config/env";
import { fetchTwelveDataPrice } from "@/backend/clients/twelveData";
import { normalizeTickers } from "@/shared/utils/tickers";

type PriceMap = Record<string, number>;

export type GetPricesInput = {
  tickers: string[];
};

export type GetPricesResult = {
  prices: PriceMap;
  warnings: string[];
  error: string | null;
};

export async function getPrices({
  tickers,
}: GetPricesInput): Promise<GetPricesResult> {
  const normalizedTickers = normalizeTickers(tickers);
  const prices: PriceMap = {};
  const warnings: string[] = [];
  let error: string | null = null;

  if (!ENV.TWELVEDATA_API_KEY) {
    return {
      prices: {},
      warnings: [],
      error: "Missing TWELVEDATA_API_KEY",
    };
  }

  for (const ticker of normalizedTickers) {
    try {
      const price = await fetchTwelveDataPrice(ticker);
      prices[ticker] = price;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown price fetch error";

      console.error(`[getPrices] ${ticker}:`, err);
      warnings.push(`${ticker}: ${message}`);

      if (!error) {
        error = message;
      }
    }
  }

  return {
    prices,
    warnings,
    error,
  };
}
