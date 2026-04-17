import { ENV } from "@/backend/config/env";
import { fetchTwelveDataPrice } from "@/backend/clients/twelveData";
import { getTwelveDataRequestQueue } from "@/backend/services/market/twelveDataRequestQueue";
import { normalizeTickers } from "@/shared/utils/tickers";

type PriceMap = Record<string, number>;

export type PriceRequestItem = {
  ticker: string;
  totalCost: number;
};

export type GetPricesInput = {
  items: PriceRequestItem[];
};

export type GetPricesResult = {
  prices: PriceMap;
  warnings: string[];
  error: string | null;
};

export async function getPrices({
  items,
}: GetPricesInput): Promise<GetPricesResult> {
  const normalizedItems = normalizePriceItems(items);
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

  if (normalizedItems.length === 0) {
    return {
      prices: {},
      warnings: [],
      error: null,
    };
  }

  const queue = getTwelveDataRequestQueue();

  const results = await Promise.all(
    normalizedItems.map(async ({ ticker }) => {
      try {
        const price = await queue.enqueue(
          `twelvedata:price:${ticker}`,
          async () => fetchTwelveDataPrice(ticker)
        );

        return {
          ticker,
          price,
          error: null as string | null,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown price fetch error";

        return {
          ticker,
          price: null as number | null,
          error: message,
        };
      }
    })
  );

  for (const result of results) {
    if (typeof result.price === "number" && Number.isFinite(result.price)) {
      prices[result.ticker] = result.price;
      continue;
    }

    const message = `${result.ticker}: ${result.error}`;
    warnings.push(message);

    if (!error) {
      error = result.error ?? "Unknown price fetch error";
    }

    console.error(`[getPrices] ${result.ticker}:`, result.error);
  }

  return {
    prices,
    warnings,
    error,
  };
}

function normalizePriceItems(items: PriceRequestItem[]): PriceRequestItem[] {
  const seen = new Set<string>();
  const normalized: PriceRequestItem[] = [];

  for (const item of items) {
    const ticker = normalizeTickers([item.ticker])[0];
    if (!ticker || seen.has(ticker)) continue;

    seen.add(ticker);
    normalized.push({
      ticker,
      totalCost: Number(item.totalCost ?? 0),
    });
  }

  return normalized;
}
