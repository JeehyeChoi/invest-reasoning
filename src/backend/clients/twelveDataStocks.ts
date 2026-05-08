import { ENV } from "@/backend/config/env";

export type TwelveDataStockRecord = {
  symbol?: string;
  name?: string;
  currency?: string;
  exchange?: string;
  mic_code?: string;
  country?: string;
  type?: string;
  figi_code?: string;
};

type TwelveDataStocksResponse = {
  data?: TwelveDataStockRecord[];
  count?: number;
  status?: string;
  message?: string;
  code?: number;
};

export async function fetchTwelveDataStocksBySymbol(
  symbol: string,
): Promise<TwelveDataStockRecord[]> {
  if (!ENV.TWELVEDATA_API_KEY) {
    throw new Error("Missing TWELVEDATA_API_KEY");
  }

  const url = new URL("https://api.twelvedata.com/stocks");

  url.searchParams.set("symbol", symbol.trim().toUpperCase());
  url.searchParams.set("country", "United States");
  url.searchParams.set("apikey", ENV.TWELVEDATA_API_KEY);

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Twelve Data stocks request failed for ${symbol}: ${response.status} ${text}`,
    );
  }

  const payload = (await response.json()) as TwelveDataStocksResponse;

  if (payload.status === "error") {
    throw new Error(
      `Twelve Data stocks error for ${symbol}: ${payload.message ?? payload.code ?? "unknown error"}`,
    );
  }

  return payload.data ?? [];
}

export async function fetchTwelveDataEtfsBySymbol(
  symbol: string,
): Promise<TwelveDataStockRecord[]> {
  if (!ENV.TWELVEDATA_API_KEY) {
    throw new Error("Missing TWELVEDATA_API_KEY");
  }

  const url = new URL("https://api.twelvedata.com/etfs");

  url.searchParams.set("symbol", symbol.trim().toUpperCase());
  url.searchParams.set("country", "United States");
  url.searchParams.set("apikey", ENV.TWELVEDATA_API_KEY);

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Twelve Data etfs request failed for ${symbol}: ${response.status} ${text}`,
    );
  }

  const payload = (await response.json()) as TwelveDataStocksResponse;

  if (payload.status === "error") {
    throw new Error(
      `Twelve Data etfs error for ${symbol}: ${payload.message ?? payload.code ?? "unknown error"}`,
    );
  }

  return (payload.data ?? []).map((record) => ({
    ...record,
    type: record.type ?? "ETF",
  }));
}
