import {
  fetchTwelveDataEtfsBySymbol,
  fetchTwelveDataStocksBySymbol,
  type TwelveDataStockRecord,
} from "@/backend/clients/twelveDataStocks";
import { buildTwelveDataShareClassTickerCandidates } from "@/backend/services/market/providerSymbols/buildTwelveDataShareClassTickerCandidates";
import {
  getTickerProviderSymbol,
  upsertTickerProviderSymbol,
  type TickerProviderSymbolRow,
} from "@/backend/services/market/providerSymbols/tickerProviderSymbolsRepository";

export async function resolveTwelveDataProviderSymbol(
  ticker: string,
): Promise<TickerProviderSymbolRow | null> {
  const normalizedTicker = ticker.trim().toUpperCase();
  const existing = await getTickerProviderSymbol({
    ticker: normalizedTicker,
    provider: "twelve_data",
  });

  if (
    (existing?.status === "disabled" && existing.source !== "auto_skip_share_class") ||
    (existing?.status === "verified" && hasUsableProviderIdentity(existing))
  ) {
    return existing;
  }

  const directResolution = await resolveTwelveDataCatalogSymbol(normalizedTicker);
  const fallbackResolutions = directResolution.match
    ? []
    : await resolveTwelveDataFallbackCatalogSymbols(normalizedTicker);
  const fallbackResolution = fallbackResolutions.find((result) => result.match);
  const records = dedupeTwelveDataRecordsBySymbol([
    ...directResolution.records,
    ...fallbackResolutions.flatMap((result) => result.records),
  ]);
  const match = directResolution.match ?? fallbackResolution?.match;

  if (!match?.symbol) {
    await upsertTickerProviderSymbol({
      ticker: normalizedTicker,
      provider: "twelve_data",
      providerSymbol: null,
      status: "unresolved",
      source: "auto",
      candidateSymbols: records
        .map((record) => record.symbol)
        .filter((symbol): symbol is string => Boolean(symbol)),
      lastError: `Twelve Data asset catalog did not resolve ${normalizedTicker}`,
    });

    return null;
  }

  await upsertTickerProviderSymbol({
    ticker: normalizedTicker,
    provider: "twelve_data",
    providerSymbol: match.symbol,
    exchange: match.exchange ?? null,
    country: match.country ?? null,
    instrumentType: match.type ?? null,
    micCode: match.mic_code ?? null,
    status: "verified",
    source: fallbackResolution ? "auto_compact_share_class_fallback" : "auto",
    candidateSymbols: records
      .map((record) => record.symbol)
      .filter((symbol): symbol is string => Boolean(symbol)),
    metadata: {
      name: match.name,
      currency: match.currency,
      figiCode: match.figi_code,
    },
  });

  return getTickerProviderSymbol({
    ticker: normalizedTicker,
    provider: "twelve_data",
  });
}

type TwelveDataCatalogResolution = {
  querySymbol: string;
  records: TwelveDataStockRecord[];
  match: TwelveDataStockRecord | undefined;
};

async function resolveTwelveDataCatalogSymbol(
  querySymbol: string,
): Promise<TwelveDataCatalogResolution> {
  const stockRecords = await fetchTwelveDataStocksBySymbol(querySymbol);
  const stockMatch = pickBestUsInstrumentMatch(stockRecords, querySymbol);
  const etfRecords = stockMatch ? [] : await fetchTwelveDataEtfsBySymbol(querySymbol);
  const records = [...stockRecords, ...etfRecords];

  return {
    querySymbol,
    records,
    match: stockMatch ?? pickBestUsInstrumentMatch(etfRecords, querySymbol),
  };
}

async function resolveTwelveDataFallbackCatalogSymbols(
  ticker: string,
): Promise<TwelveDataCatalogResolution[]> {
  const candidateSymbols = buildTwelveDataShareClassTickerCandidates(ticker);
  const results: TwelveDataCatalogResolution[] = [];

  for (const candidateSymbol of candidateSymbols) {
    results.push(await resolveTwelveDataCatalogSymbol(candidateSymbol));
  }

  return results;
}

function isSupportedUsEquityExchange(exchange: string | undefined): boolean {
  return exchange === "NYSE" || exchange === "NASDAQ" || exchange === "AMEX";
}

function pickBestUsInstrumentMatch(
  records: TwelveDataStockRecord[],
  ticker: string,
): TwelveDataStockRecord | undefined {
  return (
    records.find(
      (record) =>
        record.symbol?.toUpperCase() === ticker &&
        isSupportedUsEquityExchange(record.exchange),
    ) ?? records.find((record) => record.symbol?.toUpperCase() === ticker)
  );
}

function hasUsableProviderIdentity(row: TickerProviderSymbolRow): boolean {
  return Boolean(row.providerSymbol && (row.micCode || row.exchange || row.country));
}

function dedupeTwelveDataRecordsBySymbol(
  records: TwelveDataStockRecord[],
): TwelveDataStockRecord[] {
  const seen = new Set<string>();
  const result: TwelveDataStockRecord[] = [];

  for (const record of records) {
    const symbol = record.symbol?.toUpperCase();
    if (!symbol || seen.has(symbol)) continue;

    seen.add(symbol);
    result.push(record);
  }

  return result;
}
