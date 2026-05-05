import type { FmpTickerProfileRecord } from "@/backend/clients/fmp/types";
import type { TickerCoreRows } from "@/backend/services/ticker-core/types";

const SOURCE = "fmp_profile";

export function mapFmpTickerProfileToTickerCoreRows(
  raw: FmpTickerProfileRecord,
): TickerCoreRows {
  const ticker = raw.symbol.trim().toUpperCase();

  return {
    identity: {
      ticker,
      cik: normalizeText(raw.cik),
      companyName: normalizeText(raw.companyName),
      exchange: normalizeText(raw.exchange),
      exchangeFullName: normalizeText(raw.exchangeFullName),
      source: SOURCE,
    },
    profile: {
      ticker,
      description: normalizeText(raw.description),
      website: normalizeText(raw.website),
      ceo: normalizeText(raw.ceo),
      country: normalizeText(raw.country),
      state: normalizeText(raw.state),
      city: normalizeText(raw.city),
      zip: normalizeText(raw.zip),
      address: normalizeText(raw.address),
      phone: normalizeText(raw.phone),
      fullTimeEmployees: toInt(raw.fullTimeEmployees),
      ipoDate: normalizeDate(raw.ipoDate),
      source: SOURCE,
    },
    classification: {
      ticker,
      sector: normalizeText(raw.sector),
      industry: normalizeText(raw.industry),
      currency: normalizeText(raw.currency),
      cusip: normalizeText(raw.cusip),
      isin: normalizeText(raw.isin),
      isEtf: raw.isEtf ?? null,
      isFund: raw.isFund ?? null,
      isAdr: raw.isAdr ?? null,
      isActivelyTrading: raw.isActivelyTrading ?? null,
      source: SOURCE,
    },
    marketSnapshot: {
      ticker,
      price: toNumber(raw.price),
      marketCap: toNumber(raw.marketCap),
      beta: toNumber(raw.beta),
      lastDividend: toNumber(raw.lastDividend),
      fiftyTwoWeekRange: normalizeText(raw.range),
      priceChange: toNumber(raw.change),
      priceChangePercentage: toNumber(raw.changePercentage),
      volume: toInt(raw.volume),
      averageVolume: toInt(raw.averageVolume),
      source: SOURCE,
    },
  };
}

function normalizeText(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeDate(value: string | undefined): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInt(value: unknown): number | null {
  const parsed = toNumber(value);
  return parsed == null ? null : Math.trunc(parsed);
}
