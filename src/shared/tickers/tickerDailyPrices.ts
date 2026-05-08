export type TickerDailyPriceSeries = {
  ticker: string;
  provider: string;
  adjustmentPolicy: string;
  points: TickerDailyPricePoint[];
};

export type TickerDailyPricePoint = {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
};
