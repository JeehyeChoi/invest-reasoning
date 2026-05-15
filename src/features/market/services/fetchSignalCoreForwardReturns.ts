import type { SignalTimelineAxisScope } from "@/shared/market/signalCombinationTimeline";

export type SignalCoreForwardWindow = "1M" | "3M" | "6M" | "12M";

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

export type SignalCoreForwardReturns = {
  asOfDate: string;
  axisScope: SignalTimelineAxisScope;
  previousThreshold: number;
  peakThreshold: number;
  coreGroupCount: number;
  coreTickerCount: number;
  provider: string;
  adjustmentPolicy: string;
  summaries: SignalCoreForwardReturnSummary[];
  benchmarkTickers: string[];
  benchmarkSummaries: SignalCoreForwardBenchmarkSummary[];
};

export type FetchCachedSignalCoreForwardReturnsInput = {
  asOfDates: string[];
  axisScope?: SignalTimelineAxisScope;
};

export type CachedSignalCoreForwardReturnsResponse = {
  axisScope: SignalTimelineAxisScope;
  results: SignalCoreForwardReturns[];
  missingAsOfDates: string[];
};

export type FetchSignalCoreForwardReturnsInput = {
  asOfDate: string;
  axisScope?: SignalTimelineAxisScope;
};

export async function fetchSignalCoreForwardReturns(
  input: FetchSignalCoreForwardReturnsInput,
): Promise<SignalCoreForwardReturns> {
  const params = new URLSearchParams({
    asOfDate: input.asOfDate,
  });
  if (input.axisScope) params.set("axisScope", input.axisScope);

  const response = await fetch(
    `/api/market/signal-combinations/core-forward-returns?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch signal core forward returns.");
  }

  return response.json();
}

export async function fetchCachedSignalCoreForwardReturns(
  input: FetchCachedSignalCoreForwardReturnsInput,
): Promise<CachedSignalCoreForwardReturnsResponse> {
  const params = new URLSearchParams();
  params.set("asOfDates", input.asOfDates.join(","));
  if (input.axisScope) params.set("axisScope", input.axisScope);

  const response = await fetch(
    `/api/market/signal-combinations/core-forward-returns/cached?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch cached signal core forward returns.");
  }

  return response.json();
}
