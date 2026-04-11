import { ENV } from "@/backend/config/env";
import type { RawTickerProfile } from "@/backend/schemas/tickerProfile";

export async function fetchTickerProfile(
  ticker: string,
): Promise<RawTickerProfile> {
  const normalizedTicker = ticker.trim().toUpperCase();

  const url =
    `https://financialmodelingprep.com/stable/profile` +
    `?symbol=${normalizedTicker}&apikey=${ENV.FMP_API_KEY}`;

  const res = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `FMP request failed for ${normalizedTicker}: ${res.status}`,
    );
  }

  const json = (await res.json()) as RawTickerProfile[];

  if (!Array.isArray(json) || json.length === 0) {
    throw new Error(`No profile data for ${normalizedTicker}`);
  }

  return json[0];
}
