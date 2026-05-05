import { ENV } from "@/backend/config/env";
import {
  formatFmpUsageSnapshot,
  recordFmpApiUsage,
} from "@/backend/clients/fmpUsage";
import type {
  FmpSp500ConstituentRecord,
  FmpTickerProfileRecord,
} from "@/backend/clients/fmp/types";

/**
 * ----------------------------------------
 * Internal helper
 * ----------------------------------------
 */

async function fetchFmpJson<T>(
  url: string,
  endpoint: string,
  errorMessage: string
): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });
  const rawBody = await res.text();
  const usageSnapshot = await recordFmpApiUsage({
    endpoint,
    statusCode: res.status,
    responseBytes: byteLength(rawBody),
  });

  if (usageSnapshot?.isLimitReached) {
    console.warn(
      `FMP rolling bandwidth limit reached: ${formatFmpUsageSnapshot(usageSnapshot)}`,
    );
  } else if (usageSnapshot?.isWarning) {
    console.warn(
      `FMP rolling bandwidth usage is high: ${formatFmpUsageSnapshot(usageSnapshot)}`,
    );
  }

  if (!res.ok) {
    const error = new Error(`${errorMessage}: ${res.status}`);
    (error as Error & { status?: number }).status = res.status;
    throw error;
  }

  return JSON.parse(rawBody) as T;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/**
 * ----------------------------------------
 * API: Profile
 * ----------------------------------------
 */

export async function fetchFmpTickerProfile(
  ticker: string
): Promise<FmpTickerProfileRecord> {
  const normalizedTicker = ticker.trim().toUpperCase();

  const url =
    `https://financialmodelingprep.com/stable/profile` +
    `?symbol=${normalizedTicker}&apikey=${ENV.FMP_API_KEY}`;

  const json = await fetchFmpJson<FmpTickerProfileRecord[]>(
    url,
    "stable/profile",
    `FMP profile request failed for ${normalizedTicker}`
  );

  if (!Array.isArray(json) || json.length === 0) {
    throw new Error(`No profile data for ${normalizedTicker}`);
  }

  return json[0];
}

/**
 * ----------------------------------------
 * API: S&P 500 Constituents
 * ----------------------------------------
 */

export async function fetchFmpSp500Constituents(): Promise<
  FmpSp500ConstituentRecord[]
> {
  const url =
    `https://financialmodelingprep.com/stable/sp500-constituent` +
    `?apikey=${ENV.FMP_API_KEY}`;

  const json = await fetchFmpJson<FmpSp500ConstituentRecord[]>(
    url,
    "stable/sp500-constituent",
    "FMP S&P 500 constituents request failed"
  );

  if (!Array.isArray(json)) {
    throw new Error("Invalid S&P 500 constituents response from FMP");
  }

  return json;
}
