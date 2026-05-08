import { fetchTwelveDataDailyTimeSeries } from "@/backend/clients/twelveDataTimeSeries";
import { resolveTwelveDataProviderSymbol } from "@/backend/services/market/providerSymbols/resolveTwelveDataProviderSymbol";
import { upsertTickerProviderSymbol } from "@/backend/services/market/providerSymbols/tickerProviderSymbolsRepository";
import type {
  DailyPriceHistoryProvider,
  FetchDailyPricesInput,
  FetchDailyPricesResult,
} from "@/backend/services/market/history/types";

export const twelveDataDailyPriceHistoryProvider: DailyPriceHistoryProvider = {
  key: "twelve_data",
  async fetchDailyPrices(
    input: FetchDailyPricesInput,
  ): Promise<FetchDailyPricesResult> {
    const ticker = input.ticker.trim().toUpperCase();
    const mapping = await resolveTwelveDataProviderSymbol(ticker);

    if (mapping?.status === "disabled") {
      throw new Error(`Twelve Data symbol disabled for ${ticker}`);
    }

    if (!mapping || mapping.status === "unresolved") {
      throw new Error(
        `Twelve Data symbol unresolved for ${ticker}: ${mapping?.lastError ?? "no provider symbol"}`,
      );
    }

    const providerSymbol = input.providerSymbol ?? mapping?.providerSymbol ?? ticker;

    try {
      const result = await fetchTwelveDataDailyTimeSeries({
        ...input,
        ticker,
        providerSymbol,
        exchange: mapping.exchange,
        micCode: mapping.micCode,
        country: mapping.country,
      });

      await upsertTickerProviderSymbol({
        ticker,
        provider: "twelve_data",
        providerSymbol: result.providerSymbol,
        exchange: result.exchange,
        country: result.country,
        instrumentType: result.instrumentType,
        status: "verified",
        source: mapping?.source ?? "auto",
        candidateSymbols: [providerSymbol],
        metadata: {
          adjustmentPolicy: input.adjustmentPolicy,
          exchange: result.exchange ?? mapping.exchange,
        },
      });

      return {
        provider: "twelve_data",
        providerSymbol: result.providerSymbol,
        exchange: result.exchange,
        country: result.country,
        instrumentType: result.instrumentType,
        adjustmentPolicy: input.adjustmentPolicy,
        rows: result.rows,
      };
    } catch (error) {
      if (isDataNotFoundError(error)) {
        await upsertTickerProviderSymbol({
          ticker,
          provider: "twelve_data",
          providerSymbol,
          exchange: mapping.exchange,
          country: mapping.country,
          instrumentType: mapping.instrumentType,
          micCode: mapping.micCode,
          status: "unresolved",
          source: mapping?.source ?? "auto",
          candidateSymbols: [providerSymbol],
          metadata: {
            previousStatus: mapping.status,
          },
          lastError: getErrorMessage(error),
        });
      }

      throw error;
    }
  },
};

function isDataNotFoundError(error: unknown): boolean {
  return getErrorMessage(error).includes("Data not found");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
