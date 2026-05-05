import { fetchFmpTickerProfile } from "@/backend/clients/fmp";
import { mapFmpTickerProfileToTickerCoreRows } from "@/backend/services/ticker-core/mapFmpTickerProfile";
import {
  countTickerCoreSyncCandidates,
  findTickerCoreSyncCandidates,
  upsertTickerCoreRows,
} from "@/backend/services/ticker-core/repository";
import type { UniverseKey } from "@/shared/universe/universes";

export type RunTickerCoreSyncWorkflowInput = {
  universeKeys: UniverseKey[];
  maxRequests?: number;
  staleAfterDays?: number;
  onProgress?: (progress: {
    message: string;
    level?: "info" | "warning" | "error";
    current?: number;
    total?: number;
    label?: string;
  }) => void;
};

export type RunTickerCoreSyncWorkflowResult = {
  candidateCount: number;
  processedCount: number;
  failedCount: number;
  maxRequests: number;
  staleAfterDays: number;
  stoppedByRateLimit: boolean;
};

const DEFAULT_MAX_REQUESTS = 200;
export const DEFAULT_TICKER_CORE_STALE_AFTER_DAYS = 90;

export async function countMissingOrStaleTickerCoreSyncCandidates(input: {
  universeKeys: UniverseKey[];
  staleAfterDays?: number;
}): Promise<{ candidateCount: number; staleAfterDays: number }> {
  const staleAfterDays = normalizePositiveInt(
    input.staleAfterDays,
    DEFAULT_TICKER_CORE_STALE_AFTER_DAYS,
  );

  const candidateCount = await countTickerCoreSyncCandidates({
    universeKeys: input.universeKeys,
    staleAfterDays,
  });

  return {
    candidateCount,
    staleAfterDays,
  };
}

export async function runTickerCoreSyncWorkflow(
  input: RunTickerCoreSyncWorkflowInput,
): Promise<RunTickerCoreSyncWorkflowResult> {
  const maxRequests = normalizePositiveInt(
    input.maxRequests,
    DEFAULT_MAX_REQUESTS,
  );
  const staleAfterDays = normalizePositiveInt(
    input.staleAfterDays,
    DEFAULT_TICKER_CORE_STALE_AFTER_DAYS,
  );

  const candidates = await findTickerCoreSyncCandidates({
    universeKeys: input.universeKeys,
    staleAfterDays,
    limit: maxRequests,
  });

  input.onProgress?.({
    message: `FMP ticker core sync candidates resolved. staleAfterDays=${staleAfterDays}, candidates=${candidates.length}, requestCap=${maxRequests}.`,
    current: 0,
    total: candidates.length,
  });

  let processedCount = 0;
  let failedCount = 0;
  let stoppedByRateLimit = false;

  for (let index = 0; index < candidates.length; index += 1) {
    const ticker = candidates[index];

    input.onProgress?.({
      message: `Syncing ticker core data: ${ticker}.`,
      current: index + 1,
      total: candidates.length,
      label: ticker,
    });

    try {
      const raw = await fetchFmpTickerProfile(ticker);
      const rows = mapFmpTickerProfileToTickerCoreRows(raw);
      await upsertTickerCoreRows(rows);
      processedCount += 1;
    } catch (error) {
      if (isRateLimitError(error)) {
        stoppedByRateLimit = true;
        input.onProgress?.({
          message: `FMP ticker core sync stopped by rate limit at ${ticker}. processed=${processedCount}, failed=${failedCount}.`,
          level: "warning",
          current: index + 1,
          total: candidates.length,
          label: ticker,
        });
        break;
      }

      failedCount += 1;
      input.onProgress?.({
        message: `FMP ticker core sync failed for ${ticker}: ${getErrorMessage(error)}`,
        level: "warning",
        current: index + 1,
        total: candidates.length,
        label: ticker,
      });
      console.error(`Ticker core sync failed for ${ticker}:`, error);
    }
  }

  return {
    candidateCount: candidates.length,
    processedCount,
    failedCount,
    maxRequests,
    staleAfterDays,
    stoppedByRateLimit,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function normalizePositiveInt(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    return fallback;
  }
  return value;
}

function isRateLimitError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 429
  );
}
