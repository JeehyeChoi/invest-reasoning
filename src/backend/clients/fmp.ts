import { ENV } from "@/backend/config/env";
import type { RawTickerProfile } from "@/backend/schemas/tickers/tickerProfile";
import type { FmpUsMarketHolidayRecord } from "@/backend/schemas/fmp";

/**
 * ----------------------------------------
 * Internal helper
 * ----------------------------------------
 */

async function fetchFmpJson<T>(
  url: string,
  errorMessage: string
): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`${errorMessage}: ${res.status}`);
  }

  return (await res.json()) as T;
}

/**
 * ----------------------------------------
 * API: Profile
 * ----------------------------------------
 */

export async function fetchFmpTickerProfile(
  ticker: string
): Promise<RawTickerProfile> {
  const normalizedTicker = ticker.trim().toUpperCase();

  const url =
    `https://financialmodelingprep.com/stable/profile` +
    `?symbol=${normalizedTicker}&apikey=${ENV.FMP_API_KEY}`;

  const json = await fetchFmpJson<RawTickerProfile[]>(
    url,
    `FMP profile request failed for ${normalizedTicker}`
  );

  if (!Array.isArray(json) || json.length === 0) {
    throw new Error(`No profile data for ${normalizedTicker}`);
  }

  return json[0];
}

/**
 * ----------------------------------------
 * API: US Market Holidays
 * ----------------------------------------
 */

export async function fetchFmpUsMarketHolidays(): Promise<
  FmpUsMarketHolidayRecord[]
> {
  const url =
    `https://financialmodelingprep.com/stable/holidays-by-exchange` +
    `?exchange=NASDAQ&apikey=${ENV.FMP_API_KEY}`;

  const json = await fetchFmpJson<FmpUsMarketHolidayRecord[]>(
    url,
    "FMP holiday request failed"
  );

  if (!Array.isArray(json)) {
    throw new Error("Invalid holiday response from FMP");
  }

  return json;
}
