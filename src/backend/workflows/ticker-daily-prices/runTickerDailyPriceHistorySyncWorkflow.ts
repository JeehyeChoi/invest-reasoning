import {
  syncTickerDailyPriceHistory,
  type SyncTickerDailyPriceHistoryInput,
} from "@/backend/services/market/history/syncTickerDailyPriceHistory";

export type RunTickerDailyPriceHistorySyncWorkflowInput =
  SyncTickerDailyPriceHistoryInput;

export async function runTickerDailyPriceHistorySyncWorkflow(
  input: RunTickerDailyPriceHistorySyncWorkflowInput = {},
) {
  const result = await syncTickerDailyPriceHistory(input);

  return {
    status: "completed" as const,
    ...result,
  };
}
