export type DailyPriceAdjustmentPolicy =
  | "splits"
  | "dividends"
  | "all"
  | "none"
  | "vendor_adjusted"
  | "unknown";

export type DailyPriceProviderKey = "twelve_data";

export type TickerDailyPriceRow = {
  ticker: string;
  provider: DailyPriceProviderKey | string;
  providerSymbol: string;
  priceDate: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
  adjustmentPolicy: DailyPriceAdjustmentPolicy | string;
  sourcePayload?: unknown;
};

export type TickerDailyPriceSyncState = {
  ticker: string;
  provider: DailyPriceProviderKey | string;
  adjustmentPolicy: DailyPriceAdjustmentPolicy | string;
  providerSymbol: string | null;
  targetStartDate: string | null;
  earliestPriceDate: string | null;
  latestPriceDate: string | null;
  rowCount: number;
  status: TickerDailyPriceSyncStatus;
  lastError: string | null;
};

export type TickerDailyPriceSyncStatus =
  | "pending"
  | "completed"
  | "partial"
  | "failed"
  | "no_data";

export type FetchDailyPricesInput = {
  ticker: string;
  providerSymbol?: string;
  startDate?: string;
  endDate?: string;
  outputSize?: number;
  adjustmentPolicy: DailyPriceAdjustmentPolicy;
};

export type FetchDailyPricesResult = {
  provider: DailyPriceProviderKey | string;
  providerSymbol: string;
  exchange: string | null;
  country: string | null;
  instrumentType: string | null;
  adjustmentPolicy: DailyPriceAdjustmentPolicy | string;
  rows: TickerDailyPriceRow[];
};

export type DailyPriceHistoryProvider = {
  key: DailyPriceProviderKey | string;
  fetchDailyPrices(input: FetchDailyPricesInput): Promise<FetchDailyPricesResult>;
};
