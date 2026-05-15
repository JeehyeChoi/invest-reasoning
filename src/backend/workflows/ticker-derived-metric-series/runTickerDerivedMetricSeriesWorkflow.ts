import {
  buildTickerDerivedMetricSeries,
  buildTickerDerivedMetricSeriesTimeline,
  type BuildTickerDerivedMetricSeriesResult,
} from "@/backend/services/valuation/factors/buildTickerDerivedMetricSeries";
import {
  resolveSnapshotDates,
  type SnapshotFrequency,
} from "@/backend/workflows/utils/snapshotDates";

export type RunTickerDerivedMetricSeriesWorkflowInput = {
  tickers?: string[];
  tickerCikMap?: Record<string, string | null>;
  provider?: string;
  adjustmentPolicy?: string;
  asOfDate?: string;
  snapshotDates?: string[];
  startDate?: string;
  endDate?: string;
  frequency?: SnapshotFrequency;
  onProgress?: (progress: {
    message: string;
    current?: number;
    total?: number;
    label?: string;
  }) => void;
};

export type RunTickerDerivedMetricSeriesWorkflowResult =
  BuildTickerDerivedMetricSeriesResult & {
    snapshotDates?: string[];
    completedRuns?: number;
  };

export async function runTickerDerivedMetricSeriesWorkflow(
  input: RunTickerDerivedMetricSeriesWorkflowInput = {},
): Promise<RunTickerDerivedMetricSeriesWorkflowResult> {
  const snapshotDates = resolveSnapshotDates({
    ...input,
    defaultToTimeline: !input.asOfDate,
  });
  if (snapshotDates.length > 0) {
    return buildTickerDerivedMetricSeriesTimeline({
      tickers: input.tickers,
      tickerCikMap: input.tickerCikMap,
      provider: input.provider,
      adjustmentPolicy: input.adjustmentPolicy,
      snapshotDates,
      onProgress: input.onProgress,
    });
  }

  return buildTickerDerivedMetricSeries({
    tickers: input.tickers,
    tickerCikMap: input.tickerCikMap,
    provider: input.provider,
    adjustmentPolicy: input.adjustmentPolicy,
    asOfDate: input.asOfDate,
    onProgress: input.onProgress,
  });
}
