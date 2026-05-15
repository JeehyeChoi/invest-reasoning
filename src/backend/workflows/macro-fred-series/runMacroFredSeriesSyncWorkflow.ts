import {
  syncFredMacroSeriesObservations,
  type SyncFredMacroSeriesObservationsInput,
} from "@/backend/services/macro/fred/syncFredMacroSeriesObservations";

export type RunMacroFredSeriesSyncWorkflowInput =
  SyncFredMacroSeriesObservationsInput;

export async function runMacroFredSeriesSyncWorkflow(
  input: RunMacroFredSeriesSyncWorkflowInput = {},
) {
  const { seriesResults, failedSeriesResults } =
    await syncFredMacroSeriesObservations({
      observationStart: input.observationStart,
      observationEnd: input.observationEnd,
      requestDelayMs: input.requestDelayMs ?? 600,
      onProgress: input.onProgress,
    });
  const rowCount = seriesResults.reduce(
    (sum, result) => sum + result.rowCount,
    0,
  );

  return {
    status: "completed" as const,
    rowCount,
    seriesResults,
    failedSeriesResults,
  };
}
