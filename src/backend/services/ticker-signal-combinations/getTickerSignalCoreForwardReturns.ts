import { db } from "@/backend/config/db";
import { getTickerSignalCombinationOverview } from "@/backend/services/ticker-signal-combinations/getTickerSignalCombinationOverview";
import type { SignalTimelineAxisScope } from "@/shared/market/signalCombinationTimeline";
import {
  SIGNAL_CORE_FORWARD_BENCHMARK_TICKERS,
} from "@/shared/market/signalCoreForwardBenchmarks";

export const SIGNAL_CORE_FORWARD_WINDOWS = ["1M", "3M", "6M", "12M"] as const;

export type SignalCoreForwardWindow =
  (typeof SIGNAL_CORE_FORWARD_WINDOWS)[number];

export type SignalCoreForwardReturnRow = {
  ticker: string;
  startPriceDate: string | null;
  startClose: number | null;
  windows: Partial<
    Record<
      SignalCoreForwardWindow,
      {
        targetDate: string;
        endPriceDate: string | null;
        endClose: number | null;
        return: number | null;
      }
    >
  >;
};

export type SignalCoreForwardReturnSummary = {
  window: SignalCoreForwardWindow;
  targetDate: string;
  observedCount: number;
  meanReturn: number | null;
  medianReturn: number | null;
};

export type SignalCoreForwardBenchmarkSummary = {
  ticker: string;
  window: SignalCoreForwardWindow;
  targetDate: string;
  startPriceDate: string | null;
  endPriceDate: string | null;
  return: number | null;
};

export type GetTickerSignalCoreForwardReturnsInput = {
  asOfDate: string;
  axisScope?: SignalTimelineAxisScope;
  provider?: string;
  adjustmentPolicy?: string;
  windows?: SignalCoreForwardWindow[];
  benchmarkTickers?: string[];
  useCache?: boolean;
};

export type GetTickerSignalCoreForwardReturnsResult = {
  asOfDate: string;
  axisScope: SignalTimelineAxisScope;
  previousThreshold: number;
  peakThreshold: number;
  coreGroupCount: number;
  coreTickerCount: number;
  provider: string;
  adjustmentPolicy: string;
  windows: SignalCoreForwardWindow[];
  summaries: SignalCoreForwardReturnSummary[];
  benchmarkTickers: string[];
  benchmarkSummaries: SignalCoreForwardBenchmarkSummary[];
  rows: SignalCoreForwardReturnRow[];
};

export type StoredTickerSignalCoreForwardReturnsSummary = Omit<
  GetTickerSignalCoreForwardReturnsResult,
  "rows"
>;

type PricePoint = {
  ticker: string;
  priceDate: string;
  close: number;
};

type PriceRow = {
  ticker: string;
  price_date: Date | string;
  close: number | string;
};

type StoredForwardReturnsRow = {
  as_of_date: Date | string;
  axis_scope: SignalTimelineAxisScope;
  previous_threshold: number | string;
  peak_threshold: number | string;
  core_group_count: number | string;
  core_ticker_count: number | string;
  provider: string;
  adjustment_policy: string;
  windows: unknown;
  summaries: unknown;
  benchmark_tickers: unknown;
  benchmark_summaries: unknown;
};

const DEFAULT_AXIS_SCOPE: SignalTimelineAxisScope = "fundamentals";
const DEFAULT_PROVIDER = "twelve_data";
const DEFAULT_ADJUSTMENT_POLICY = "splits";
export async function getTickerSignalCoreForwardReturns(
  input: GetTickerSignalCoreForwardReturnsInput,
): Promise<GetTickerSignalCoreForwardReturnsResult> {
  const axisScope = input.axisScope ?? DEFAULT_AXIS_SCOPE;
  const provider = input.provider ?? DEFAULT_PROVIDER;
  const adjustmentPolicy = input.adjustmentPolicy ?? DEFAULT_ADJUSTMENT_POLICY;
  const windows = input.windows ?? [...SIGNAL_CORE_FORWARD_WINDOWS];
  const benchmarkTickers = normalizeBenchmarkTickers(input.benchmarkTickers);
  const cached =
    input.useCache === false
      ? null
      : await loadStoredForwardReturns({
          asOfDate: input.asOfDate,
          axisScope,
          provider,
          adjustmentPolicy,
          windows,
          benchmarkTickers,
        });

  if (cached) return cached;

  const overview = await getTickerSignalCombinationOverview({
    asOfDate: input.asOfDate,
    axisScope,
    detailMode: "latestFlow",
    includePercolationMemberTickers: true,
  });
  const analysis = overview.percolationBridgeAnalyses.find((item) =>
    item.label.toLowerCase().includes("percolation"),
  );

  if (!analysis) {
    throw new Error("No percolation split analysis is available for this event.");
  }

  const tickers = [...new Set(analysis.largestBeforeTickers ?? [])].sort();
  const startPrices = await loadFirstPricesOnOrAfter({
    tickers,
    asOfDate: input.asOfDate,
    provider,
    adjustmentPolicy,
  });
  const windowEndPrices = new Map<SignalCoreForwardWindow, Map<string, PricePoint>>();

  for (const window of windows) {
    windowEndPrices.set(
      window,
      await loadFirstPricesOnOrAfter({
        tickers,
        asOfDate: addMonths(input.asOfDate, monthsForWindow(window)),
        provider,
        adjustmentPolicy,
      }),
    );
  }

  const rows = tickers.map((ticker) => {
    const start = startPrices.get(ticker) ?? null;
    const row: SignalCoreForwardReturnRow = {
      ticker,
      startPriceDate: start?.priceDate ?? null,
      startClose: start?.close ?? null,
      windows: {},
    };

    for (const window of windows) {
      const targetDate = addMonths(input.asOfDate, monthsForWindow(window));
      const end = windowEndPrices.get(window)?.get(ticker) ?? null;
      const value =
        start && end && start.close > 0 ? end.close / start.close - 1 : null;

      row.windows[window] = {
        targetDate,
        endPriceDate: end?.priceDate ?? null,
        endClose: end?.close ?? null,
        return: value,
      };
    }

    return row;
  });
  const benchmarkSummaries = await buildBenchmarkSummaries({
    benchmarkTickers,
    asOfDate: input.asOfDate,
    provider,
    adjustmentPolicy,
    windows,
  });

  const result = {
    asOfDate: input.asOfDate,
    axisScope,
    previousThreshold: analysis.previousThreshold,
    peakThreshold: analysis.peakThreshold,
    coreGroupCount: analysis.largestBeforeSize,
    coreTickerCount: tickers.length,
    provider,
    adjustmentPolicy,
    windows,
    summaries: windows.map((window) => summarizeWindow(rows, window)),
    benchmarkTickers,
    benchmarkSummaries,
    rows,
  };

  await upsertStoredForwardReturns(result);

  return result;
}

async function loadStoredForwardReturns(input: {
  asOfDate: string;
  axisScope: SignalTimelineAxisScope;
  provider: string;
  adjustmentPolicy: string;
  windows: SignalCoreForwardWindow[];
  benchmarkTickers: string[];
}): Promise<GetTickerSignalCoreForwardReturnsResult | null> {
  const result = await db.query<StoredForwardReturnsRow>(
    `
      SELECT
        as_of_date,
        axis_scope,
        previous_threshold,
        peak_threshold,
        core_group_count,
        core_ticker_count,
        provider,
        adjustment_policy,
        windows,
        summaries,
        benchmark_tickers,
        benchmark_summaries
      FROM public.ticker_signal_core_forward_returns
      WHERE as_of_date = $1::date
        AND axis_scope = $2
        AND lens = 'idfWeightedJaccard'
        AND provider = $3
        AND adjustment_policy = $4
        AND source_model_key = 'factor_signal'
        AND source_model_version = 'v0'
      LIMIT 1
    `,
    [input.asOfDate, input.axisScope, input.provider, input.adjustmentPolicy],
  );
  const row = result.rows[0];

  if (!row) return null;

  const summaries = normalizeStoredSummaries(row.summaries);
  const benchmarkTickers = normalizeBenchmarkTickers(row.benchmark_tickers);
  const benchmarkSummaries = normalizeStoredBenchmarkSummaries(
    row.benchmark_summaries,
  );
  const summariesByWindow = new Map(
    summaries.map((summary) => [summary.window, summary]),
  );
  const selectedSummaries = input.windows.flatMap((window) => {
    const summary = summariesByWindow.get(window);

    return summary ? [summary] : [];
  });

  if (selectedSummaries.length !== input.windows.length) return null;
  if (
    !hasRequiredBenchmarkSummaries({
      benchmarkSummaries,
      benchmarkTickers: input.benchmarkTickers,
      windows: input.windows,
    })
  ) {
    return null;
  }

  return {
    asOfDate: toIsoDate(row.as_of_date),
    axisScope: row.axis_scope,
    previousThreshold: Number(row.previous_threshold),
    peakThreshold: Number(row.peak_threshold),
    coreGroupCount: Number(row.core_group_count),
    coreTickerCount: Number(row.core_ticker_count),
    provider: row.provider,
    adjustmentPolicy: row.adjustment_policy,
    windows: input.windows,
    summaries: selectedSummaries,
    benchmarkTickers,
    benchmarkSummaries: benchmarkSummaries.filter(
      (summary) =>
        input.benchmarkTickers.includes(summary.ticker) &&
        input.windows.includes(summary.window),
    ),
    rows: [],
  };
}

export async function listStoredTickerSignalCoreForwardReturns(input: {
  axisScope: SignalTimelineAxisScope;
  asOfDates: string[];
  provider?: string;
  adjustmentPolicy?: string;
  windows?: SignalCoreForwardWindow[];
  benchmarkTickers?: string[];
}): Promise<StoredTickerSignalCoreForwardReturnsSummary[]> {
  if (input.asOfDates.length === 0) return [];

  const provider = input.provider ?? DEFAULT_PROVIDER;
  const adjustmentPolicy = input.adjustmentPolicy ?? DEFAULT_ADJUSTMENT_POLICY;
  const windows = input.windows ?? [...SIGNAL_CORE_FORWARD_WINDOWS];
  const benchmarkTickers = normalizeBenchmarkTickers(input.benchmarkTickers);
  const result = await db.query<StoredForwardReturnsRow>(
    `
      SELECT
        as_of_date,
        axis_scope,
        previous_threshold,
        peak_threshold,
        core_group_count,
        core_ticker_count,
        provider,
        adjustment_policy,
        windows,
        summaries,
        benchmark_tickers,
        benchmark_summaries
      FROM public.ticker_signal_core_forward_returns
      WHERE as_of_date = ANY($1::date[])
        AND axis_scope = $2
        AND lens = 'idfWeightedJaccard'
        AND provider = $3
        AND adjustment_policy = $4
        AND source_model_key = 'factor_signal'
        AND source_model_version = 'v0'
      ORDER BY as_of_date ASC
    `,
    [input.asOfDates, input.axisScope, provider, adjustmentPolicy],
  );

  return result.rows.flatMap((row) => {
    const summaries = normalizeStoredSummaries(row.summaries);
    const rowBenchmarkTickers = normalizeBenchmarkTickers(row.benchmark_tickers);
    const benchmarkSummaries = normalizeStoredBenchmarkSummaries(
      row.benchmark_summaries,
    );
    const summariesByWindow = new Map(
      summaries.map((summary) => [summary.window, summary]),
    );
    const selectedSummaries = windows.flatMap((window) => {
      const summary = summariesByWindow.get(window);

      return summary ? [summary] : [];
    });

    if (selectedSummaries.length !== windows.length) return [];
    if (
      !hasRequiredBenchmarkSummaries({
        benchmarkSummaries,
        benchmarkTickers,
        windows,
      })
    ) {
      return [];
    }

    return [
      {
        asOfDate: toIsoDate(row.as_of_date),
        axisScope: row.axis_scope,
        previousThreshold: Number(row.previous_threshold),
        peakThreshold: Number(row.peak_threshold),
        coreGroupCount: Number(row.core_group_count),
        coreTickerCount: Number(row.core_ticker_count),
        provider: row.provider,
        adjustmentPolicy: row.adjustment_policy,
        windows,
        summaries: selectedSummaries,
        benchmarkTickers: rowBenchmarkTickers,
        benchmarkSummaries: benchmarkSummaries.filter(
          (summary) =>
            benchmarkTickers.includes(summary.ticker) &&
            windows.includes(summary.window),
        ),
      },
    ];
  });
}

async function upsertStoredForwardReturns(
  input: GetTickerSignalCoreForwardReturnsResult,
) {
  await db.query(
    `
      INSERT INTO public.ticker_signal_core_forward_returns (
        as_of_date,
        axis_scope,
        lens,
        previous_threshold,
        peak_threshold,
        core_group_count,
        core_ticker_count,
        provider,
        adjustment_policy,
        windows,
        summaries,
        benchmark_tickers,
        benchmark_summaries
      )
      VALUES (
        $1::date,
        $2,
        'idfWeightedJaccard',
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9::jsonb,
        $10::jsonb,
        $11::jsonb,
        $12::jsonb
      )
      ON CONFLICT (
        as_of_date,
        axis_scope,
        lens,
        provider,
        adjustment_policy,
        source_model_key,
        source_model_version
      )
      DO UPDATE SET
        previous_threshold = EXCLUDED.previous_threshold,
        peak_threshold = EXCLUDED.peak_threshold,
        core_group_count = EXCLUDED.core_group_count,
        core_ticker_count = EXCLUDED.core_ticker_count,
        windows = EXCLUDED.windows,
        summaries = EXCLUDED.summaries,
        benchmark_tickers = EXCLUDED.benchmark_tickers,
        benchmark_summaries = EXCLUDED.benchmark_summaries,
        computed_at = now(),
        updated_at = now()
    `,
    [
      input.asOfDate,
      input.axisScope,
      input.previousThreshold,
      input.peakThreshold,
      input.coreGroupCount,
      input.coreTickerCount,
      input.provider,
      input.adjustmentPolicy,
      JSON.stringify(input.windows),
      JSON.stringify(input.summaries),
      JSON.stringify(input.benchmarkTickers),
      JSON.stringify(input.benchmarkSummaries),
    ],
  );
}

function normalizeStoredSummaries(
  value: unknown,
): SignalCoreForwardReturnSummary[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const summary = item as Partial<SignalCoreForwardReturnSummary>;

    if (
      !SIGNAL_CORE_FORWARD_WINDOWS.includes(
        summary.window as SignalCoreForwardWindow,
      ) ||
      typeof summary.targetDate !== "string" ||
      typeof summary.observedCount !== "number"
    ) {
      return [];
    }

    return [
      {
        window: summary.window as SignalCoreForwardWindow,
        targetDate: summary.targetDate,
        observedCount: summary.observedCount,
        meanReturn:
          typeof summary.meanReturn === "number" ? summary.meanReturn : null,
        medianReturn:
          typeof summary.medianReturn === "number" ? summary.medianReturn : null,
      },
    ];
  });
}

function normalizeStoredBenchmarkSummaries(
  value: unknown,
): SignalCoreForwardBenchmarkSummary[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const summary = item as Partial<SignalCoreForwardBenchmarkSummary>;

    if (
      typeof summary.ticker !== "string" ||
      !SIGNAL_CORE_FORWARD_WINDOWS.includes(
        summary.window as SignalCoreForwardWindow,
      ) ||
      typeof summary.targetDate !== "string"
    ) {
      return [];
    }

    return [
      {
        ticker: normalizeTicker(summary.ticker),
        window: summary.window as SignalCoreForwardWindow,
        targetDate: summary.targetDate,
        startPriceDate:
          typeof summary.startPriceDate === "string"
            ? summary.startPriceDate
            : null,
        endPriceDate:
          typeof summary.endPriceDate === "string" ? summary.endPriceDate : null,
        return: typeof summary.return === "number" ? summary.return : null,
      },
    ];
  });
}

function hasRequiredBenchmarkSummaries(input: {
  benchmarkSummaries: SignalCoreForwardBenchmarkSummary[];
  benchmarkTickers: string[];
  windows: SignalCoreForwardWindow[];
}) {
  const available = new Set(
    input.benchmarkSummaries.map(
      (summary) => `${summary.ticker}:${summary.window}`,
    ),
  );

  return input.benchmarkTickers.every((ticker) =>
    input.windows.every((window) => available.has(`${ticker}:${window}`)),
  );
}

async function buildBenchmarkSummaries(input: {
  benchmarkTickers: string[];
  asOfDate: string;
  provider: string;
  adjustmentPolicy: string;
  windows: SignalCoreForwardWindow[];
}): Promise<SignalCoreForwardBenchmarkSummary[]> {
  const startPrices = await loadFirstPricesOnOrAfter({
    tickers: input.benchmarkTickers,
    asOfDate: input.asOfDate,
    provider: input.provider,
    adjustmentPolicy: input.adjustmentPolicy,
  });
  const summaries: SignalCoreForwardBenchmarkSummary[] = [];

  for (const window of input.windows) {
    const targetDate = addMonths(input.asOfDate, monthsForWindow(window));
    const endPrices = await loadFirstPricesOnOrAfter({
      tickers: input.benchmarkTickers,
      asOfDate: targetDate,
      provider: input.provider,
      adjustmentPolicy: input.adjustmentPolicy,
    });

    for (const ticker of input.benchmarkTickers) {
      const start = startPrices.get(ticker) ?? null;
      const end = endPrices.get(ticker) ?? null;

      summaries.push({
        ticker,
        window,
        targetDate,
        startPriceDate: start?.priceDate ?? null,
        endPriceDate: end?.priceDate ?? null,
        return:
          start && end && start.close > 0 ? end.close / start.close - 1 : null,
      });
    }
  }

  return summaries;
}

async function loadFirstPricesOnOrAfter(input: {
  tickers: string[];
  asOfDate: string;
  provider: string;
  adjustmentPolicy: string;
}) {
  if (input.tickers.length === 0) return new Map<string, PricePoint>();

  const result = await db.query<PriceRow>(
    `
      SELECT DISTINCT ON (ticker)
        ticker,
        price_date,
        close
      FROM public.ticker_daily_prices
      WHERE ticker = ANY($1::text[])
        AND provider = $2
        AND adjustment_policy = $3
        AND price_date >= $4::date
      ORDER BY ticker, price_date ASC
    `,
    [input.tickers, input.provider, input.adjustmentPolicy, input.asOfDate],
  );

  return new Map(
    result.rows
      .map((row): PricePoint | null => {
        const close = Number(row.close);
        if (!Number.isFinite(close) || close <= 0) return null;

        return {
          ticker: row.ticker,
          priceDate: toIsoDate(row.price_date),
          close,
        };
      })
      .filter((row): row is PricePoint => row !== null)
      .map((row) => [row.ticker, row]),
  );
}

function normalizeBenchmarkTickers(value: unknown) {
  if (!Array.isArray(value)) return [...SIGNAL_CORE_FORWARD_BENCHMARK_TICKERS];

  const tickers = value
    .map((item) => (typeof item === "string" ? normalizeTicker(item) : ""))
    .filter(Boolean);

  return tickers.length > 0
    ? [...new Set(tickers)]
    : [...SIGNAL_CORE_FORWARD_BENCHMARK_TICKERS];
}

function normalizeTicker(value: string) {
  return value.trim().toUpperCase();
}

function summarizeWindow(
  rows: SignalCoreForwardReturnRow[],
  window: SignalCoreForwardWindow,
): SignalCoreForwardReturnSummary {
  const returns = rows
    .map((row) => row.windows[window]?.return)
    .filter((value): value is number => value !== null && value !== undefined)
    .sort((a, b) => a - b);
  const targetDate = rows.find((row) => row.windows[window])?.windows[window]
    ?.targetDate;

  return {
    window,
    targetDate: targetDate ?? "",
    observedCount: returns.length,
    meanReturn:
      returns.length === 0
        ? null
        : returns.reduce((total, value) => total + value, 0) / returns.length,
    medianReturn: median(returns),
  };
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const middle = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[middle];

  return (values[middle - 1] + values[middle]) / 2;
}

function monthsForWindow(window: SignalCoreForwardWindow) {
  switch (window) {
    case "1M":
      return 1;
    case "3M":
      return 3;
    case "6M":
      return 6;
    case "12M":
      return 12;
  }
}

function addMonths(isoDate: string, months: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + months);

  return toIsoDate(date);
}

function toIsoDate(value: Date | string) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  return value.slice(0, 10);
}
