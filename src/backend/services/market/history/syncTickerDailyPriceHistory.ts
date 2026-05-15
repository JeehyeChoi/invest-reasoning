import {
  findTickerDailyPriceSyncCandidates,
  upsertTickerDailyPriceRows,
  upsertTickerDailyPriceSyncState,
} from "@/backend/services/market/history/repository";
import { getDailyPriceHistoryProvider } from "@/backend/services/market/history/providers";
import type {
  DailyPriceAdjustmentPolicy,
  DailyPriceProviderKey,
  TickerDailyPriceRow,
} from "@/backend/services/market/history/types";
import {
  DEFAULT_UNIVERSE_KEYS,
  normalizeUniverseKeys,
  type UniverseKey,
} from "@/shared/universe/universes";

export type SyncTickerDailyPriceHistoryInput = {
  tickers?: string[];
  universeKeys?: UniverseKey[];
  provider?: DailyPriceProviderKey;
  adjustmentPolicy?: DailyPriceAdjustmentPolicy;
  endDate?: string;
  yearsBack?: number;
  maxTickers?: number;
  maxRequests?: number;
  outputSize?: number;
  requestDelayMs?: number;
  onProgress?: (progress: {
    message: string;
    level?: "info" | "warning" | "error";
    current?: number;
    total?: number;
    label?: string;
  }) => void;
};

export type SyncTickerDailyPriceHistoryResult = {
  provider: DailyPriceProviderKey;
  adjustmentPolicy: DailyPriceAdjustmentPolicy;
  targetStartDate: string;
  targetEndDate: string;
  candidateCount: number;
  processedCount: number;
  processedTickers: string[];
  failedCount: number;
  requestCount: number;
  rowCount: number;
  stoppedByRequestBudget: boolean;
  stoppedByProviderLimit: boolean;
};

const DEFAULT_PROVIDER: DailyPriceProviderKey = "twelve_data";
const DEFAULT_ADJUSTMENT_POLICY: DailyPriceAdjustmentPolicy = "splits";
const DEFAULT_YEARS_BACK = 30;
const DEFAULT_MAX_TICKERS = 350;
const DEFAULT_MAX_REQUESTS = 700;
const DEFAULT_OUTPUT_SIZE = 5000;
const DEFAULT_REQUEST_DELAY_MS = 8000;
const DEFAULT_BACKFILL_END_DATE = "2026-05-05";
const BACKFILL_WINDOW_YEARS = 10;
const MAX_PRICE_STALENESS_DAYS = 7;

export async function syncTickerDailyPriceHistory(
  input: SyncTickerDailyPriceHistoryInput = {},
): Promise<SyncTickerDailyPriceHistoryResult> {
  const providerKey = input.provider ?? DEFAULT_PROVIDER;
  const adjustmentPolicy =
    input.adjustmentPolicy ?? DEFAULT_ADJUSTMENT_POLICY;
  const yearsBack = normalizePositiveInt(input.yearsBack, DEFAULT_YEARS_BACK);
  const maxTickers = normalizePositiveInt(input.maxTickers, DEFAULT_MAX_TICKERS);
  const maxRequests = normalizePositiveInt(
    input.maxRequests,
    DEFAULT_MAX_REQUESTS,
  );
  const outputSize = normalizePositiveInt(input.outputSize, DEFAULT_OUTPUT_SIZE);
  const requestDelayMs = normalizeNonNegativeInt(
    input.requestDelayMs,
    DEFAULT_REQUEST_DELAY_MS,
  );
  const universeKeys = normalizeUniverseKeys(input.universeKeys ?? DEFAULT_UNIVERSE_KEYS);
  const targetEndDate = normalizeDateKey(input.endDate, DEFAULT_BACKFILL_END_DATE);
  const targetStartDate = toDateKey(
    addUtcYears(new Date(`${targetEndDate}T00:00:00.000Z`), -yearsBack),
  );
  const provider = getDailyPriceHistoryProvider(providerKey);
  const throttle = createRequestThrottle(requestDelayMs);
  const candidates = input.tickers?.length
    ? normalizeTickerList(input.tickers).slice(0, maxTickers)
    : await findTickerDailyPriceSyncCandidates({
        universeKeys,
        provider: providerKey,
        adjustmentPolicy,
        targetEndDate,
        limit: maxTickers,
      });

  input.onProgress?.({
    message: `Ticker daily price sync candidates resolved. provider=${providerKey}, adjustment=${adjustmentPolicy}, targetStart=${targetStartDate}, targetEnd=${targetEndDate}, candidates=${candidates.length}, requestCap=${maxRequests}.`,
    current: 0,
    total: candidates.length,
  });

  let processedCount = 0;
  let failedCount = 0;
  let requestCount = 0;
  let rowCount = 0;
  let stoppedByRequestBudget = false;
  let stoppedByProviderLimit = false;
  const processedTickers: string[] = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const ticker = candidates[index];

    if (requestCount >= maxRequests) {
      stoppedByRequestBudget = true;
      break;
    }

    input.onProgress?.({
      message: `Syncing...: ${ticker}.`,
      current: index + 1,
      total: candidates.length,
      label: ticker,
    });

    try {
      const result = await fetchTickerBackfillPages({
        ticker,
        provider,
        targetStartDate,
        targetEndDate,
        adjustmentPolicy,
        outputSize,
        throttle,
        getRemainingRequests: () => maxRequests - requestCount,
        incrementRequestCount: () => {
          requestCount += 1;
        },
      });

      const upsertedCount = await upsertTickerDailyPriceRows(result.rows);
      rowCount += upsertedCount;

      const isFresh = isDailyPriceResultFresh(result.rows, targetEndDate);
      const status =
        result.rows.length === 0 ? "no_data" : isFresh ? "completed" : "partial";

      await upsertTickerDailyPriceSyncState({
        ticker,
        provider: providerKey,
        adjustmentPolicy,
        providerSymbol: result.providerSymbol,
        targetStartDate,
        status,
        lastError: isFresh
          ? null
          : `Latest price date is older than targetEndDate by more than ${MAX_PRICE_STALENESS_DAYS} days.`,
      });

      processedCount += 1;
      processedTickers.push(ticker);

      input.onProgress?.({
        message: `Synced: ${ticker}. rows=${upsertedCount}, requests=${requestCount}.`,
        current: index + 1,
        total: candidates.length,
        label: ticker,
      });
    } catch (error) {
      if (isProviderDailyLimitError(error)) {
        stoppedByProviderLimit = true;

        await upsertTickerDailyPriceSyncState({
          ticker,
          provider: providerKey,
          adjustmentPolicy,
          providerSymbol: null,
          targetStartDate,
          status: "failed",
          lastError: getErrorMessage(error),
        });

        input.onProgress?.({
          message: `Twelve Data daily price sync stopped by daily API credit limit at ${ticker}. processed=${processedCount}, failed=${failedCount}, requests=${requestCount}.`,
          level: "warning",
          current: index + 1,
          total: candidates.length,
          label: ticker,
        });
        break;
      }

      failedCount += 1;

      await upsertTickerDailyPriceSyncState({
        ticker,
        provider: providerKey,
        adjustmentPolicy,
        providerSymbol: null,
        targetStartDate,
        status: "failed",
        lastError: getErrorMessage(error),
      });

      input.onProgress?.({
        message: `Twelve Data daily price failed for ${ticker}: ${getErrorMessage(error)}`,
        level: "warning",
        current: index + 1,
        total: candidates.length,
        label: ticker,
      });
    }
  }

  return {
    provider: providerKey,
    adjustmentPolicy,
    targetStartDate,
    targetEndDate,
    candidateCount: candidates.length,
    processedCount,
    processedTickers,
    failedCount,
    requestCount,
    rowCount,
    stoppedByRequestBudget,
    stoppedByProviderLimit,
  };
}

async function fetchTickerBackfillPages(input: {
  ticker: string;
  provider: ReturnType<typeof getDailyPriceHistoryProvider>;
  targetStartDate: string;
  targetEndDate: string;
  adjustmentPolicy: DailyPriceAdjustmentPolicy;
  outputSize: number;
  throttle: () => Promise<void>;
  getRemainingRequests: () => number;
  incrementRequestCount: () => void;
}): Promise<{ providerSymbol: string | null; rows: TickerDailyPriceRow[] }> {
  const rowsByDate = new Map<string, TickerDailyPriceRow>();
  let providerSymbol: string | null = null;
  const windows = buildBackfillWindows({
    startDate: input.targetStartDate,
    endDate: input.targetEndDate,
    windowYears: BACKFILL_WINDOW_YEARS,
  });

  for (const window of windows) {
    if (input.getRemainingRequests() <= 0) {
      break;
    }

    await input.throttle();
    input.incrementRequestCount();

    const result = await input.provider.fetchDailyPrices({
      ticker: input.ticker,
      startDate: window.startDate,
      endDate: window.endDate,
      outputSize: input.outputSize,
      adjustmentPolicy: input.adjustmentPolicy,
    });

    providerSymbol = result.providerSymbol;

    for (const row of result.rows) {
      rowsByDate.set(row.priceDate, row);
    }
  }

  return {
    providerSymbol,
    rows: [...rowsByDate.values()].sort((a, b) =>
      a.priceDate.localeCompare(b.priceDate),
    ),
  };
}

function buildBackfillWindows(input: {
  startDate: string;
  endDate: string;
  windowYears: number;
}): { startDate: string; endDate: string }[] {
  const windows: { startDate: string; endDate: string }[] = [];
  let endDate = input.endDate;

  while (endDate >= input.startDate) {
    const rawStartDate = toDateKey(
      addUtcDays(
        addUtcYears(new Date(`${endDate}T00:00:00.000Z`), -input.windowYears),
        1,
      ),
    );
    const startDate =
      rawStartDate < input.startDate ? input.startDate : rawStartDate;

    windows.unshift({ startDate, endDate });

    endDate = toDateKey(addUtcDays(new Date(`${startDate}T00:00:00.000Z`), -1));
  }

  return windows;
}

function addUtcYears(date: Date, years: number): Date {
  const next = new Date(date);
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createRequestThrottle(requestDelayMs: number): () => Promise<void> {
  let lastRequestStartedAt = 0;

  return async () => {
    if (requestDelayMs <= 0 || lastRequestStartedAt === 0) {
      lastRequestStartedAt = Date.now();
      return;
    }

    const elapsedMs = Date.now() - lastRequestStartedAt;
    const waitMs = Math.max(0, requestDelayMs - elapsedMs);

    if (waitMs > 0) {
      await delay(waitMs);
    }

    lastRequestStartedAt = Date.now();
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isProviderDailyLimitError(error: unknown): boolean {
  const message = getErrorMessage(error);

  return (
    message.includes("You have run out of API credits for the day") ||
    message.includes("current limit being 800")
  );
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function normalizeNonNegativeInt(
  value: number | undefined,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return fallback;
  }
  return value;
}

function normalizeDateKey(value: string | undefined, fallback: string): string {
  if (!value) return fallback;

  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return toDateKey(date);
}

function isDailyPriceResultFresh(
  rows: TickerDailyPriceRow[],
  targetEndDate: string,
): boolean {
  const latestPriceDate = rows
    .map((row) => row.priceDate)
    .sort((a, b) => b.localeCompare(a))[0];
  if (!latestPriceDate) return false;

  return daysBetween(latestPriceDate, targetEndDate) <= MAX_PRICE_STALENESS_DAYS;
}

function daysBetween(leftDate: string, rightDate: string): number {
  const left = Date.parse(`${leftDate}T00:00:00.000Z`);
  const right = Date.parse(`${rightDate}T00:00:00.000Z`);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(right - left) / 86_400_000;
}

function normalizeTickerList(tickers: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const ticker of tickers) {
    const value = ticker.trim().toUpperCase();

    if (!value || seen.has(value) || !isDailyPriceTickerCandidate(value)) continue;

    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

function isDailyPriceTickerCandidate(value: string): boolean {
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(value);
}
