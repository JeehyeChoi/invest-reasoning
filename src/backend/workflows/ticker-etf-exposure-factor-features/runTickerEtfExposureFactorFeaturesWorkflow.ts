import {
  buildTickerEtfExposureFactorFeatures,
  buildTickerEtfExposureFactorFeaturesTimeline,
  type BuildTickerEtfExposureFactorFeaturesResult,
} from "@/backend/services/market/factors/buildTickerEtfExposureFactorFeatures";
import {
  resolveSnapshotDates,
  type SnapshotFrequency,
} from "@/backend/workflows/utils/snapshotDates";

export type RunTickerEtfExposureFactorFeaturesWorkflowInput = {
  tickers?: string[];
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

export type RunTickerEtfExposureFactorFeaturesWorkflowResult =
  BuildTickerEtfExposureFactorFeaturesResult & {
    snapshotDates?: string[];
    completedRuns?: number;
  };

export async function runTickerEtfExposureFactorFeaturesWorkflow(
  input: RunTickerEtfExposureFactorFeaturesWorkflowInput = {},
): Promise<RunTickerEtfExposureFactorFeaturesWorkflowResult> {
  const snapshotDates = resolveSnapshotDates({
    ...input,
    defaultToTimeline: !input.asOfDate,
  });
  if (snapshotDates.length > 0) {
    return buildTickerEtfExposureFactorFeaturesTimeline({
      tickers: input.tickers,
      provider: input.provider,
      adjustmentPolicy: input.adjustmentPolicy,
      snapshotDates,
      onProgress: input.onProgress,
    });
  }

  return buildTickerEtfExposureFactorFeatures({
    tickers: input.tickers,
    provider: input.provider,
    adjustmentPolicy: input.adjustmentPolicy,
    asOfDate: input.asOfDate,
    onProgress: input.onProgress,
  });
}
