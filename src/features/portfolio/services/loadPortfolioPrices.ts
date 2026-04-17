import { fetchPrices, type PriceRequestItem } from "./fetchPrices";

type PriceMap = Record<string, number>;

export type LoadPortfolioPricesProgress = {
  completed: number;
  total: number;
  currentBatch: number;
  totalBatches: number;
  message: string;
};

export type LoadPortfolioPricesResult = {
  prices: PriceMap;
  failedTickers: string[];
  warnings: string[];
  error: string | null;
};

export type LoadPortfolioPriceItem = {
  ticker?: string;
  totalCost?: number | null;
};

type LoadPortfolioPricesInput = {
  items: LoadPortfolioPriceItem[];
  onProgress?: (progress: LoadPortfolioPricesProgress) => void;
  onBatchComplete?: (partialPrices: PriceMap) => void;
  onWarning?: (warning: string) => void;
  onError?: (error: string) => void;
};

const PRICE_BATCH_SIZE = 8;

export async function loadPortfolioPrices({
  items,
  onProgress,
  onBatchComplete,
  onWarning,
  onError,
}: LoadPortfolioPricesInput): Promise<LoadPortfolioPricesResult> {
  const normalizedItems = normalizePortfolioPriceItems(items);

  if (normalizedItems.length === 0) {
    return {
      prices: {},
      failedTickers: [],
      warnings: [],
      error: null,
    };
  }

  const prioritizedItems = normalizedItems.filter((item) => item.totalCost > 0);
  const secondaryItems = normalizedItems.filter((item) => item.totalCost <= 0);

  const orderedItems = [...prioritizedItems, ...secondaryItems];
  const batches = chunkArray(orderedItems, PRICE_BATCH_SIZE);

  const prices: PriceMap = {};
  const failedTickers = new Set<string>();
  const warnings: string[] = [];
  let error: string | null = null;
  let completed = 0;

  onProgress?.({
    completed,
    total: orderedItems.length,
    currentBatch: 0,
    totalBatches: batches.length,
    message: `Loading prices... ${completed}/${orderedItems.length}`,
  });

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex];
    const result = await fetchPrices(batch);

    const partialPrices: PriceMap = {};

    for (const item of batch) {
      const ticker = item.ticker;
      const price = result.prices[ticker];
      const tickerWarnings = result.warnings.filter((warning) =>
        warning.includes(ticker)
      );

      if (typeof price === "number" && Number.isFinite(price)) {
        prices[ticker] = price;
        partialPrices[ticker] = price;
      } else {
        failedTickers.add(ticker);
      }

      for (const warning of tickerWarnings) {
        warnings.push(warning);
        onWarning?.(warning);
      }
    }

    if (Object.keys(partialPrices).length > 0) {
      onBatchComplete?.(partialPrices);
    }

    if (result.error && !error) {
      error = result.error;
      onError?.(result.error);
    }

    completed += batch.length;

    onProgress?.({
      completed,
      total: orderedItems.length,
      currentBatch: batchIndex + 1,
      totalBatches: batches.length,
      message: `Loading prices... ${completed}/${orderedItems.length}`,
    });
  }

  return {
    prices,
    failedTickers: Array.from(failedTickers),
    warnings,
    error,
  };
}

function normalizePortfolioPriceItems(
  items: LoadPortfolioPriceItem[]
): PriceRequestItem[] {
  const byTicker = new Map<string, number>();

  for (const item of items) {
    const rawTicker = item.ticker?.trim().toUpperCase();

    if (!rawTicker) {
      continue;
    }

    const totalCost = Number(item.totalCost ?? 0);
    const prev = byTicker.get(rawTicker) ?? 0;

    byTicker.set(rawTicker, prev + totalCost);
  }

  return Array.from(byTicker.entries()).map(([ticker, totalCost]) => ({
    ticker,
    totalCost,
  }));
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}
