import { ENV } from "@/backend/config/env";
import type {
  DailyPriceAdjustmentPolicy,
  TickerDailyPriceRow,
} from "@/backend/services/market/history/types";

type TwelveDataTimeSeriesValue = {
  datetime?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
};

type TwelveDataTimeSeriesResponse = {
  meta?: {
    symbol?: string;
    exchange?: string;
    country?: string;
    type?: string;
  };
  values?: TwelveDataTimeSeriesValue[];
  code?: number;
  message?: string;
  status?: string;
};

type TimeSeriesIdentity = {
  micCode?: string;
  exchange?: string;
};

export type FetchTwelveDataDailyTimeSeriesInput = {
  ticker: string;
  providerSymbol?: string;
  exchange?: string | null;
  micCode?: string | null;
  country?: string | null;
  startDate?: string;
  endDate?: string;
  outputSize?: number;
  adjustmentPolicy: DailyPriceAdjustmentPolicy;
};

export type FetchTwelveDataDailyTimeSeriesResult = {
  providerSymbol: string;
  exchange: string | null;
  country: string | null;
  instrumentType: string | null;
  rows: TickerDailyPriceRow[];
};

const TWELVE_DATA_TIME_SERIES_URL = "https://api.twelvedata.com/time_series";
const TWELVE_DATA_PROVIDER = "twelve_data";

export async function fetchTwelveDataDailyTimeSeries({
  ticker,
  providerSymbol: inputProviderSymbol,
  exchange,
  micCode,
  startDate,
  endDate,
  outputSize = 5000,
  adjustmentPolicy,
}: FetchTwelveDataDailyTimeSeriesInput): Promise<FetchTwelveDataDailyTimeSeriesResult> {
  if (!ENV.TWELVEDATA_API_KEY) {
    throw new Error("Missing TWELVEDATA_API_KEY");
  }

  const providerSymbol = normalizeTwelveDataSymbol(inputProviderSymbol ?? ticker);
  const payload = await requestTwelveDataTimeSeriesPayload(
    buildTimeSeriesUrl({
      providerSymbol,
      identity: pickTimeSeriesIdentity({ micCode, exchange }),
      startDate,
      endDate,
      outputSize,
      adjustmentPolicy,
    }),
    providerSymbol,
  );

  const rows = (payload.values ?? [])
    .map((value): TickerDailyPriceRow | null => {
      const priceDate = value.datetime;
      const close = toFiniteNumber(value.close);

      if (!priceDate || close === null) {
        return null;
      }

      return {
        ticker: ticker.toUpperCase(),
        provider: TWELVE_DATA_PROVIDER,
        providerSymbol,
        priceDate,
        open: toFiniteNumber(value.open),
        high: toFiniteNumber(value.high),
        low: toFiniteNumber(value.low),
        close,
        volume: toFiniteInteger(value.volume),
        adjustmentPolicy,
        sourcePayload: value,
      };
    })
    .filter((row): row is TickerDailyPriceRow => row !== null);

  return {
    providerSymbol: payload.meta?.symbol ?? providerSymbol,
    exchange: payload.meta?.exchange ?? null,
    country: payload.meta?.country ?? null,
    instrumentType: payload.meta?.type ?? null,
    rows,
  };
}

async function requestTwelveDataTimeSeriesPayload(
  url: URL,
  providerSymbol: string,
): Promise<TwelveDataTimeSeriesResponse> {
  let lastPayload: TwelveDataTimeSeriesResponse | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Twelve Data time_series request failed for ${providerSymbol}: ${response.status} ${text}`,
      );
    }

    const payload = (await response.json()) as TwelveDataTimeSeriesResponse;

    if (payload.status !== "error") {
      return payload;
    }

    lastPayload = payload;

    if (isNoDataForDateWindowPayload(payload)) {
      return {
        values: [],
        status: "ok",
      };
    }

    if (attempt < 2 && isMinuteCreditLimitError(payload)) {
      await delay(65_000);
      continue;
    }

    break;
  }

  throw new Error(
    `Twelve Data time_series error for ${providerSymbol}: ${lastPayload?.message ?? lastPayload?.code ?? "unknown error"}`,
  );
}

function buildTimeSeriesUrl(input: {
  providerSymbol: string;
  identity: TimeSeriesIdentity;
  startDate?: string;
  endDate?: string;
  outputSize: number;
  adjustmentPolicy: DailyPriceAdjustmentPolicy;
}): URL {
  const url = new URL(TWELVE_DATA_TIME_SERIES_URL);

  url.searchParams.set("symbol", input.providerSymbol);
  url.searchParams.set("interval", "1day");
  url.searchParams.set("apikey", ENV.TWELVEDATA_API_KEY);
  url.searchParams.set("format", "JSON");
  url.searchParams.set("order", "ASC");
  url.searchParams.set("adjust", input.adjustmentPolicy);

  if (!input.startDate || !input.endDate) {
    url.searchParams.set("outputsize", String(clampOutputSize(input.outputSize)));
  }

  if (input.identity.micCode) {
    url.searchParams.set("mic_code", input.identity.micCode);
  }

  if (input.identity.exchange) {
    url.searchParams.set("exchange", input.identity.exchange);
  }

  if (input.startDate) {
    url.searchParams.set("start_date", input.startDate);
  }

  if (input.endDate) {
    url.searchParams.set("end_date", input.endDate);
  }

  return url;
}

function pickTimeSeriesIdentity(input: {
  micCode?: string | null;
  exchange?: string | null;
}): TimeSeriesIdentity {
  if (input.micCode) {
    return { micCode: input.micCode };
  }

  if (input.exchange) {
    return { exchange: input.exchange };
  }

  return {};
}

function isMinuteCreditLimitError(payload: TwelveDataTimeSeriesResponse): boolean {
  return payload.message?.includes("current limit being 8") ?? false;
}

function isNoDataForDateWindowPayload(
  payload: TwelveDataTimeSeriesResponse,
): boolean {
  return (
    payload.message ===
    "No data is available on the specified dates. Try setting different start/end dates."
  );
}

function normalizeTwelveDataSymbol(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function clampOutputSize(value: number): number {
  if (!Number.isInteger(value) || value < 1) return 5000;
  return Math.min(value, 5000);
}

function toFiniteNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim() === "") return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toFiniteInteger(value: string | undefined): number | null {
  const parsed = toFiniteNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
