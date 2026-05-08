import { db } from "@/backend/config/db";
import type { TickerDailyPriceSeries } from "@/shared/tickers/tickerDailyPrices";

type Row = {
  price_date: Date | string;
  provider: string;
  adjustment_policy: string;
  open: number | string | null;
  high: number | string | null;
  low: number | string | null;
  close: number | string;
  volume: number | string | null;
};

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

export async function getTickerDailyPriceSeries(
  ticker: string,
): Promise<TickerDailyPriceSeries> {
  const normalizedTicker = normalizeTicker(ticker);

  const result = await db.query<Row>(
    `
    SELECT
      price_date,
      provider,
      adjustment_policy,
      open,
      high,
      low,
      close,
      volume
    FROM public.ticker_daily_prices
    WHERE ticker = $1
      AND provider = 'twelve_data'
      AND adjustment_policy = 'splits'
    ORDER BY price_date ASC
    `,
    [normalizedTicker],
  );

  const first = result.rows[0];

  return {
    ticker: normalizedTicker,
    provider: first?.provider ?? "twelve_data",
    adjustmentPolicy: first?.adjustment_policy ?? "splits",
    points: result.rows
      .map((row) => ({
        date: toIsoDate(row.price_date),
        open: toNullableNumber(row.open),
        high: toNullableNumber(row.high),
        low: toNullableNumber(row.low),
        close: Number(row.close),
        volume: toNullableNumber(row.volume),
      }))
      .filter((point) => Number.isFinite(point.close)),
  };
}

function toNullableNumber(value: number | string | null): number | null {
  if (value === null) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}
