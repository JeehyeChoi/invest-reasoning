import {
  buildTickerValuationFactorFeatures,
  type BuildTickerValuationFactorFeaturesResult,
} from "@/backend/services/valuation/factors/buildTickerValuationFactorFeatures";

export type RunTickerValuationMetricSeriesEnrichedWorkflowInput = {
  tickers?: string[];
  tickerCikMap?: Record<string, string | null>;
  provider?: string;
  adjustmentPolicy?: string;
  onProgress?: (progress: {
    message: string;
    current?: number;
    total?: number;
    label?: string;
  }) => void;
};

export async function runTickerValuationMetricSeriesEnrichedWorkflow(
  input: RunTickerValuationMetricSeriesEnrichedWorkflowInput = {},
): Promise<BuildTickerValuationFactorFeaturesResult> {
  return buildTickerValuationFactorFeatures({
    tickers: input.tickers,
    tickerCikMap: input.tickerCikMap,
    provider: input.provider,
    adjustmentPolicy: input.adjustmentPolicy,
    onProgress: input.onProgress,
  });
}
