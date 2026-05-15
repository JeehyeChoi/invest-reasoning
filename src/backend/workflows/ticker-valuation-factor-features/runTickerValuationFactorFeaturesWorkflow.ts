import { runTickerFactorMetricFeaturesWorkflow } from "@/backend/workflows/ticker-factor-metric-features/runTickerFactorMetricFeaturesWorkflow";
import type { SnapshotFrequency } from "@/backend/workflows/utils/snapshotDates";
import type { DataPipelineRefreshJobKey } from "@/shared/data-pipeline/jobs";

type WorkflowProgress = {
  job?: DataPipelineRefreshJobKey;
  message: string;
  current?: number;
  total?: number;
  label?: string;
};

export type RunTickerValuationFactorFeaturesWorkflowInput = {
  tickers: string[];
  tickerCikMap?: Record<string, string | null>;
  asOfDate?: string;
  snapshotDates?: string[];
  startDate?: string;
  endDate?: string;
  frequency?: SnapshotFrequency;
  onProgress?: (progress: WorkflowProgress) => void;
};

export async function runTickerValuationFactorFeaturesWorkflow(
  input: RunTickerValuationFactorFeaturesWorkflowInput,
) {
  return runTickerFactorMetricFeaturesWorkflow({
    tickers: input.tickers,
    tickerCikMap: input.tickerCikMap,
    axes: ["valuation"],
    asOfDate: input.asOfDate,
    progressJob: "valuation_factor_features",
    onProgress: input.onProgress,
  });
}
