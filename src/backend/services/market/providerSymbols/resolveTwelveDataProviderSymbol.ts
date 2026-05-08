import {
  fetchTwelveDataEtfsBySymbol,
  fetchTwelveDataStocksBySymbol,
  type TwelveDataStockRecord,
} from "@/backend/clients/twelveDataStocks";
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
    existing?.status === "disabled" ||
    (existing?.status === "verified" && hasUsableProviderIdentity(existing))
  ) {
    return existing;
  }

  if (isHyphenatedShareClassTicker(normalizedTicker)) {
    await upsertTickerProviderSymbol({
      ticker: normalizedTicker,
      provider: "twelve_data",
      providerSymbol: null,
      status: "disabled",
      source: "auto_skip_share_class",
      candidateSymbols: [toDotShareClassTicker(normalizedTicker)],
      lastError: `Hyphenated share-class ticker skipped for Twelve Data: ${normalizedTicker}`,
    });

    return getTickerProviderSymbol({
      ticker: normalizedTicker,
      provider: "twelve_data",
    });
  }

  const stockRecords = await fetchTwelveDataStocksBySymbol(normalizedTicker);
  const stockMatch = pickBestUsInstrumentMatch(stockRecords, normalizedTicker);
  const etfRecords = stockMatch
    ? []
    : await fetchTwelveDataEtfsBySymbol(normalizedTicker);
  const records = [...stockRecords, ...etfRecords];
  const match =
    stockMatch ?? pickBestUsInstrumentMatch(etfRecords, normalizedTicker);

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
    source: "auto",
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

function isHyphenatedShareClassTicker(ticker: string): boolean {
  return /^[A-Z]+-[A-Z]$/.test(ticker);
}

function toDotShareClassTicker(ticker: string): string {
  return ticker.replace("-", ".");
}
