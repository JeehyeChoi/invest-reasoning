import { runTickerFactorMetricFeaturesWorkflow } from "@/backend/workflows/ticker-factor-metric-features/runTickerFactorMetricFeaturesWorkflow";
import type { DataPipelineRefreshJobKey } from "@/shared/data-pipeline/jobs";

type WorkflowProgress = {
  job?: DataPipelineRefreshJobKey;
  message: string;
  current?: number;
  total?: number;
  label?: string;
};

export type RunTickerFundamentalsFactorFeaturesWorkflowInput = {
  tickers: string[];
  tickerCikMap?: Record<string, string | null>;
  asOfDate?: string;
  onProgress?: (progress: WorkflowProgress) => void;
};

export async function runTickerFundamentalsFactorFeaturesWorkflow(
  input: RunTickerFundamentalsFactorFeaturesWorkflowInput,
) {
  return runTickerFactorMetricFeaturesWorkflow({
    tickers: input.tickers,
    tickerCikMap: input.tickerCikMap,
    axes: ["fundamentals_based"],
    asOfDate: input.asOfDate,
    progressJob: "fundamentals_based_factor_features",
    onProgress: input.onProgress,
  });
}
