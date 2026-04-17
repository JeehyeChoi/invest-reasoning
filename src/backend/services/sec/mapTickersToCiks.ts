// src/backend/services/sec/mapTickersToCiks.ts

import { getTickerProfilesByTickers } from "@/backend/services/metadata/tickerReadRepository";

export async function mapTickersToCiks(
  tickers: string[]
): Promise<Set<string>> {
  if (!Array.isArray(tickers) || tickers.length === 0) {
    return new Set<string>();
  }

  const profiles = await getTickerProfilesByTickers(tickers);
  const cikSet = new Set<string>();

  for (const profile of profiles) {
    if (!profile?.cik) {
      continue;
    }

    const cik = String(profile.cik).trim().padStart(10, "0");
    if (!cik) {
      continue;
    }

    cikSet.add(cik);
  }

  return cikSet;
}
