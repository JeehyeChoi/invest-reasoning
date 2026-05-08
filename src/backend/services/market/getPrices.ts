import { ENV } from "@/backend/config/env";
import { fetchTwelveDataPrice } from "@/backend/clients/twelveData";
import { getTwelveDataRequestQueue } from "@/backend/services/market/twelveDataRequestQueue";
import { normalizeTickers } from "@/shared/tickers/utils";

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

  const results: Array<{
    ticker: string;
    price: number | null;
    error: string | null;
  }> = [];

  for (const { ticker } of normalizedItems) {
    try {
      const price = await queue.enqueue(
        `twelvedata:price:${ticker}`,
        async () => fetchTwelveDataPrice(ticker),
      );

      results.push({
        ticker,
        price,
        error: null,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown price fetch error";

      results.push({
        ticker,
        price: null,
        error: message,
      });

      if (isTwelveDataDailyLimitMessage(message)) {
        break;
      }
    }
  }

  for (const result of results) {
    if (typeof result.price === "number" && Number.isFinite(result.price)) {
      prices[result.ticker] = result.price;
      continue;
    }

    const normalizedError = normalizePriceFetchError(result.error);
    const message = `${result.ticker}: ${normalizedError}`;
    warnings.push(message);

    if (!error) {
      error = normalizedError;
    }
  }

  return {
    prices,
    warnings,
    error,
  };
}

function normalizePriceFetchError(error: string | null): string {
  if (!error) return "Twelve Data price fetch failed";

  if (isTwelveDataDailyLimitMessage(error)) {
    return "Twelve Data daily API credit limit reached";
  }

  return `Twelve Data price fetch failed: ${error}`;
}

function isTwelveDataDailyLimitMessage(message: string): boolean {
  return (
    message.includes("You have run out of API credits for the day") ||
    message.includes("current limit being 800")
  );
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
