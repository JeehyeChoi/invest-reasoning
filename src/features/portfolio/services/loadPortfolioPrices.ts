// features/portfolio/services/loadPortfolioPrices.ts

import { fetchPrices } from "./fetchPrices";

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

type LoadPortfolioPricesInput = {
  tickers: string[];
  onProgress?: (progress: LoadPortfolioPricesProgress) => void;
  onBatchComplete?: (partialPrices: PriceMap) => void;
  onWarning?: (warning: string) => void;
  onError?: (error: string) => void;
};

type RequestListener = {
  id: number;
  requestedTickers: Set<string>;
  completedTickers: Set<string>;
  prices: PriceMap;
  failedTickers: Set<string>;
  warnings: string[];
  error: string | null;
  total: number;
  onProgress?: (progress: LoadPortfolioPricesProgress) => void;
  onBatchComplete?: (partialPrices: PriceMap) => void;
  onWarning?: (warning: string) => void;
  onError?: (error: string) => void;
  resolve: (result: LoadPortfolioPricesResult) => void;
};

const PRICE_BATCH_SIZE = 8;
const PRICE_WINDOW_MS = 60_000;
const PRICE_TTL_MS = 60_000;

/**
 * 전역 상태
 */
let requestIdSeq = 0;
let workerRunning = false;

const fetchedAtByTicker = new Map<string, number>();
const inFlightTickers = new Set<string>();
const pendingTickers = new Set<string>();
const sentTimestamps: number[] = [];
const listeners = new Map<number, RequestListener>();

function uniqueTickers(tickers: string[]): string[] {
  return Array.from(
    new Set(
      tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean)
    )
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pruneSentTimestamps(now: number): void {
  while (sentTimestamps.length > 0 && now - sentTimestamps[0] >= PRICE_WINDOW_MS) {
    sentTimestamps.shift();
  }
}

function getRemainingBudget(now: number): number {
  pruneSentTimestamps(now);
  return Math.max(0, PRICE_BATCH_SIZE - sentTimestamps.length);
}

function getWaitMsUntilNextBudget(now: number): number {
  pruneSentTimestamps(now);

  if (sentTimestamps.length < PRICE_BATCH_SIZE) {
    return 0;
  }

  const oldest = sentTimestamps[0];
  return Math.max(0, PRICE_WINDOW_MS - (now - oldest));
}

function isFreshTicker(ticker: string, now: number): boolean {
  const fetchedAt = fetchedAtByTicker.get(ticker);
  return typeof fetchedAt === "number" && now - fetchedAt < PRICE_TTL_MS;
}

function notifyProgressForAll(): void {
  for (const listener of listeners.values()) {
    const completed = listener.completedTickers.size;
    const total = listener.total;

    listener.onProgress?.({
      completed,
      total,
      currentBatch: 0,
      totalBatches: 0,
      message:
        total === 0
          ? "No tickers to load."
          : `Loading prices... ${completed}/${total}`,
    });
  }
}

function maybeFinishListener(listener: RequestListener): void {
  if (listener.completedTickers.size < listener.total) {
    return;
  }

  listeners.delete(listener.id);

  listener.resolve({
    prices: listener.prices,
    failedTickers: Array.from(listener.failedTickers),
    warnings: listener.warnings,
    error: listener.error,
  });
}

function completeTickerForListener(
  listener: RequestListener,
  ticker: string,
  outcome: {
    price?: number;
    warning?: string;
    error?: string;
    failed?: boolean;
  }
): void {
  if (!listener.requestedTickers.has(ticker)) {
    return;
  }

  if (listener.completedTickers.has(ticker)) {
    return;
  }

  listener.completedTickers.add(ticker);

  if (typeof outcome.price === "number" && Number.isFinite(outcome.price)) {
    listener.prices[ticker] = outcome.price;
    listener.onBatchComplete?.({ [ticker]: outcome.price });
  }

  if (outcome.warning) {
    listener.warnings.push(outcome.warning);
    listener.onWarning?.(outcome.warning);
  }

  if (outcome.error) {
    if (!listener.error) {
      listener.error = outcome.error;
    }
    listener.onError?.(outcome.error);
  }

  if (outcome.failed) {
    listener.failedTickers.add(ticker);
  }

  listener.onProgress?.({
    completed: listener.completedTickers.size,
    total: listener.total,
    currentBatch: 0,
    totalBatches: 0,
    message: `Loading prices... ${listener.completedTickers.size}/${listener.total}`,
  });

  maybeFinishListener(listener);
}

function buildEligibleTickers(tickers: string[]): string[] {
  const now = Date.now();

  return tickers.filter((ticker) => {
    if (inFlightTickers.has(ticker)) {
      return false;
    }

    if (isFreshTicker(ticker, now)) {
      return false;
    }

    return true;
  });
}

async function processQueue(): Promise<void> {
  if (workerRunning) {
    return;
  }

  workerRunning = true;

  try {
    while (pendingTickers.size > 0) {
      const now = Date.now();
      const remainingBudget = getRemainingBudget(now);

      if (remainingBudget <= 0) {
        const waitMs = getWaitMsUntilNextBudget(now);
        notifyProgressForAll();

        for (const listener of listeners.values()) {
          listener.onProgress?.({
            completed: listener.completedTickers.size,
            total: listener.total,
            currentBatch: 0,
            totalBatches: 0,
            message: `Loading prices... ${listener.completedTickers.size}/${listener.total}. Waiting ${Math.ceil(
              waitMs / 1000
            )}s...`,
          });
        }

        await sleep(waitMs);
        continue;
      }

      const batch: string[] = [];

      for (const ticker of pendingTickers) {
        if (batch.length >= remainingBudget) {
          break;
        }

        batch.push(ticker);
      }

      if (batch.length === 0) {
        await sleep(250);
        continue;
      }

      for (const ticker of batch) {
        pendingTickers.delete(ticker);
        inFlightTickers.add(ticker);
      }

      try {
        const result = await fetchPrices(batch);
        const fetchedAt = Date.now();

        for (let i = 0; i < batch.length; i += 1) {
          sentTimestamps.push(fetchedAt);
        }

        pruneSentTimestamps(fetchedAt);

        for (const ticker of batch) {
          const price = result.prices[ticker];
          const tickerWarning =
            result.warnings.find((warning) => warning.includes(ticker)) ?? null;

          if (typeof price === "number" && Number.isFinite(price)) {
            fetchedAtByTicker.set(ticker, fetchedAt);

            for (const listener of listeners.values()) {
              completeTickerForListener(listener, ticker, {
                price,
                warning: tickerWarning ?? undefined,
              });
            }
          } else {
            for (const listener of listeners.values()) {
              completeTickerForListener(listener, ticker, {
                warning: tickerWarning ?? undefined,
                error: result.error ?? undefined,
                failed: true,
              });
            }
          }
        }

        if (result.error) {
          for (const listener of listeners.values()) {
            if (!listener.error) {
              listener.error = result.error;
            }
            listener.onError?.(result.error);
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to fetch prices.";

        const failedBatch = [...batch];

        for (const listener of listeners.values()) {
          for (const ticker of failedBatch) {
            completeTickerForListener(listener, ticker, {
              error: message,
              failed: true,
            });
          }
        }
      } finally {
        for (const ticker of batch) {
          inFlightTickers.delete(ticker);
        }
      }
    }
  } finally {
    workerRunning = false;
  }
}

export async function loadPortfolioPrices({
  tickers,
  onProgress,
  onBatchComplete,
  onWarning,
  onError,
}: LoadPortfolioPricesInput): Promise<LoadPortfolioPricesResult> {
  const requestedTickers = uniqueTickers(tickers);
  const eligibleTickers = buildEligibleTickers(requestedTickers);

  if (requestedTickers.length === 0) {
    return {
      prices: {},
      failedTickers: [],
      warnings: [],
      error: null,
    };
  }

  return new Promise<LoadPortfolioPricesResult>((resolve) => {
    const listenerId = ++requestIdSeq;

    const completedTickers = new Set<string>();
    const prices: PriceMap = {};

    // fresh ticker는 새 요청 안 하지만, caller가 기존 priceMap을 유지하고 있다는 전제라
    // 여기서는 완료 처리만 해준다.
    const now = Date.now();
    for (const ticker of requestedTickers) {
      if (isFreshTicker(ticker, now)) {
        completedTickers.add(ticker);
      }
    }

    const listener: RequestListener = {
      id: listenerId,
      requestedTickers: new Set(requestedTickers),
      completedTickers,
      prices,
      failedTickers: new Set<string>(),
      warnings: [],
      error: null,
      total: requestedTickers.length,
      onProgress,
      onBatchComplete,
      onWarning,
      onError,
      resolve,
    };

    listeners.set(listenerId, listener);

    // 이미 fresh/in-flight 아니고 새로 보내야 하는 ticker만 큐에 추가
    for (const ticker of eligibleTickers) {
      pendingTickers.add(ticker);
    }

    // fresh ticker만 있고 새 요청이 없으면 바로 종료 가능
    if (listener.completedTickers.size === listener.total) {
      listeners.delete(listener.id);
      resolve({
        prices: listener.prices,
        failedTickers: [],
        warnings: [],
        error: null,
      });
      return;
    }

    listener.onProgress?.({
      completed: listener.completedTickers.size,
      total: listener.total,
      currentBatch: 0,
      totalBatches: 0,
      message: `Loading prices... ${listener.completedTickers.size}/${listener.total}`,
    });

    void processQueue();
  });
}
