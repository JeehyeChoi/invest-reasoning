type PriceMap = Record<string, number>;

export type PriceRequestItem = {
  ticker: string;
  totalCost: number;
};

export type FetchPricesResult = {
  prices: PriceMap;
  warnings: string[];
  error: string | null;
};

export async function fetchPrices(
  items: PriceRequestItem[]
): Promise<FetchPricesResult> {
  if (items.length === 0) {
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
    body: JSON.stringify({ items }),
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
      error: data.error ?? `Failed to fetch prices: ${res.status}`,
    };
  }

  return {
    prices: data.prices ?? {},
    warnings: data.warnings ?? [],
    error: data.error ?? null,
  };
}
