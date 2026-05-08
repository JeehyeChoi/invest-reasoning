import { buildTickerMarketPriceFactorFeatures } from "@/backend/services/market/factors/buildTickerMarketPriceFactorFeatures";

export type RunTickerMarketPriceFactorFeaturesWorkflowInput = {
  tickers?: string[];
  provider?: string;
  adjustmentPolicy?: string;
  onProgress?: (progress: {
    message: string;
    current?: number;
    total?: number;
    label?: string;
  }) => void;
};

export async function runTickerMarketPriceFactorFeaturesWorkflow(
  input: RunTickerMarketPriceFactorFeaturesWorkflowInput = {},
) {
  return buildTickerMarketPriceFactorFeatures({
    tickers: input.tickers,
    provider: input.provider,
    adjustmentPolicy: input.adjustmentPolicy,
    onProgress: input.onProgress,
  });
}
