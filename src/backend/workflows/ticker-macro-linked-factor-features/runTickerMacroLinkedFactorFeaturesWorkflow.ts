import { runTickerFactorMetricFeaturesWorkflow } from "@/backend/workflows/ticker-factor-metric-features/runTickerFactorMetricFeaturesWorkflow";
import type { DataPipelineRefreshJobKey } from "@/shared/data-pipeline/jobs";

type WorkflowProgress = {
  job?: DataPipelineRefreshJobKey;
  message: string;
  current?: number;
  total?: number;
  label?: string;
};

export type RunTickerMacroLinkedFactorFeaturesWorkflowInput = {
  tickers: string[];
  tickerCikMap?: Record<string, string | null>;
  asOfDate?: string;
  onProgress?: (progress: WorkflowProgress) => void;
};

export async function runTickerMacroLinkedFactorFeaturesWorkflow(
  input: RunTickerMacroLinkedFactorFeaturesWorkflowInput,
) {
  return runTickerFactorMetricFeaturesWorkflow({
    tickers: input.tickers,
    tickerCikMap: input.tickerCikMap,
    axes: ["macro_linked"],
    asOfDate: input.asOfDate,
    progressJob: "macro_linked_factor_features",
    onProgress: input.onProgress,
  });
}
