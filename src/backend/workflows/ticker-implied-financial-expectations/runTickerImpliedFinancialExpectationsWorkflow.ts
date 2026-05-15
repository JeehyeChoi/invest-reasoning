import {
  buildTickerImpliedFinancialExpectations,
  type BuildTickerImpliedFinancialExpectationsResult,
} from "@/backend/services/expectations/ticker/buildTickerImpliedFinancialExpectations";

export type RunTickerImpliedFinancialExpectationsWorkflowInput = {
  tickers?: string[];
  asOfDate?: string;
  provider?: string;
  adjustmentPolicy?: string;
  onProgress?: (progress: {
    message: string;
    current?: number;
    total?: number;
    label?: string;
  }) => void;
};

export async function runTickerImpliedFinancialExpectationsWorkflow(
  input: RunTickerImpliedFinancialExpectationsWorkflowInput = {},
): Promise<BuildTickerImpliedFinancialExpectationsResult> {
  return buildTickerImpliedFinancialExpectations({
    tickers: input.tickers,
    asOfDate: input.asOfDate,
    provider: input.provider,
    adjustmentPolicy: input.adjustmentPolicy,
    onProgress: input.onProgress,
  });
}
