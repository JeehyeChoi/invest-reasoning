import { ENV } from "@/backend/config/env";

export type FredSeriesObservationPayload = {
  realtime_start?: string;
  realtime_end?: string;
  date: string;
  value: string;
};

type FredSeriesObservationsResponse = {
  observations?: FredSeriesObservationPayload[];
  error_code?: number;
  error_message?: string;
};

type FredRequestError = Error & {
  retryable?: boolean;
};

type RequestFredSeriesObservationsInput = {
  seriesId: string;
  units: string;
  observationStart?: string;
  observationEnd?: string;
  maxAttempts?: number;
};

const FRED_SERIES_OBSERVATIONS_URL =
  "https://api.stlouisfed.org/fred/series/observations";
const DEFAULT_MAX_ATTEMPTS = 4;
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export async function requestFredSeriesObservations({
  seriesId,
  units,
  observationStart,
  observationEnd,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}: RequestFredSeriesObservationsInput): Promise<FredSeriesObservationPayload[]> {
  const url = new URL(FRED_SERIES_OBSERVATIONS_URL);

  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", ENV.FRED_API_KEY);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("units", units);
  url.searchParams.set("sort_order", "asc");

  if (observationStart) {
    url.searchParams.set("observation_start", observationStart);
  }

  if (observationEnd) {
    url.searchParams.set("observation_end", observationEnd);
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const isRetryable = RETRYABLE_STATUS_CODES.has(response.status);
        const error = createFredRequestError(
          `FRED observations request failed for ${seriesId}: ${response.status} ${response.statusText}`,
          isRetryable,
        );

        if (attempt < maxAttempts && isRetryable) {
          await delay(resolveRetryDelayMs(response, attempt));
          lastError = error;
          continue;
        }

        throw error;
      }

      const payload = (await response.json()) as FredSeriesObservationsResponse;

      if (payload.error_code || payload.error_message) {
        throw createFredRequestError(
          `FRED observations request failed for ${seriesId}: ${payload.error_message ?? payload.error_code}`,
          false,
        );
      }

      return payload.observations ?? [];
    } catch (error) {
      lastError = error;

      if (isNonRetryableFredRequestError(error)) {
        throw error;
      }

      if (attempt >= maxAttempts) {
        throw error;
      }

      await delay(resolveRetryDelayMs(null, attempt));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`FRED observations request failed for ${seriesId}`);
}

function createFredRequestError(
  message: string,
  retryable: boolean,
): FredRequestError {
  const error = new Error(message) as FredRequestError;
  error.retryable = retryable;
  return error;
}

function isNonRetryableFredRequestError(
  error: unknown,
): error is FredRequestError {
  return error instanceof Error && (error as FredRequestError).retryable === false;
}

function resolveRetryDelayMs(
  response: Response | null,
  attempt: number,
): number {
  const retryAfter = response?.headers.get("retry-after");

  if (retryAfter) {
    const retryAfterSeconds = Number(retryAfter);

    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
      return retryAfterSeconds * 1000;
    }
  }

  return Math.min(8000, 1000 * 2 ** (attempt - 1));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
