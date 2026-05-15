import { getFredSeriesObservations } from "@/backend/services/macro/fred/getFredSeriesObservations";
import { getFredMacroSeriesDefinitions } from "@/backend/services/macro/fred/macroFredSeriesRegistry";
import { upsertFredMacroSeriesObservations } from "@/backend/services/macro/fred/upsertFredMacroSeriesObservations";

export type SyncFredMacroSeriesObservationsInput = {
  observationStart?: string;
  observationEnd?: string;
  requestDelayMs?: number;
  onProgress?: (progress: {
    message: string;
    level?: "info" | "warning" | "error";
    current?: number;
    total?: number;
    label?: string;
  }) => void;
};

export type SyncFredMacroSeriesObservationsResult = {
  seriesId: string;
  rowCount: number;
};

export type FailedFredMacroSeriesObservationResult = {
  seriesId: string;
  errorMessage: string;
};

export type SyncFredMacroSeriesObservationsSummary = {
  seriesResults: SyncFredMacroSeriesObservationsResult[];
  failedSeriesResults: FailedFredMacroSeriesObservationResult[];
};

export async function syncFredMacroSeriesObservations(
  input: SyncFredMacroSeriesObservationsInput = {},
): Promise<SyncFredMacroSeriesObservationsSummary> {
  const results: SyncFredMacroSeriesObservationsResult[] = [];
  const failedResults: FailedFredMacroSeriesObservationResult[] = [];
  const requestDelayMs = input.requestDelayMs ?? 600;
  const definitions = getFredMacroSeriesDefinitions();
  const total = definitions.length;

  for (const [index, definition] of definitions.entries()) {
    input.onProgress?.({
      message: `Macro FRED syncing ${definition.seriesId}.`,
      current: index + 1,
      total,
      label: definition.seriesId,
    });

    if (index > 0 && requestDelayMs > 0) {
      await delay(requestDelayMs);
    }

    try {
      const observations = await getFredSeriesObservations({
        definition,
        observationStart: input.observationStart,
        observationEnd: input.observationEnd,
      });

      const rowCount = await upsertFredMacroSeriesObservations(observations);

      results.push({
        seriesId: definition.seriesId,
        rowCount,
      });

      input.onProgress?.({
        message: `Macro FRED synced ${definition.seriesId}. rows=${rowCount}.`,
        current: index + 1,
        total,
        label: definition.seriesId,
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      failedResults.push({
        seriesId: definition.seriesId,
        errorMessage,
      });

      input.onProgress?.({
        message: `Macro FRED sync skipped ${definition.seriesId}: ${errorMessage}`,
        level: "warning",
        current: index + 1,
        total,
        label: definition.seriesId,
      });
    }
  }

  return {
    seriesResults: results,
    failedSeriesResults: failedResults,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
