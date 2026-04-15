// features/portfolio/services/fetchPrices.ts

type PriceMap = Record<string, number>;

export type FetchPricesResult = {
  prices: PriceMap;
  warnings: string[];
  error: string | null;
};

export async function fetchPrices(
  tickers: string[]
): Promise<FetchPricesResult> {
  if (tickers.length === 0) {
    return {
      prices: {},
      warnings: [],
      error: null,
    };
  }

  const res = await fetch("/api/prices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tickers }),
  });

  const data = (await res.json()) as {
    prices?: PriceMap;
    warnings?: string[];
    error?: string;
  };

  if (!res.ok) {
    return {
      prices: data.prices ?? {},
      warnings: data.warnings ?? [],
      error:
        data.error ?? `Failed to fetch prices: ${res.status}`,
    };
  }

  return {
    prices: data.prices ?? {},
    warnings: data.warnings ?? [],
    error: data.error ?? null,
  };
}
