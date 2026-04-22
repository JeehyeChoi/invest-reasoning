import { db } from "@/backend/config/db";

import type { SecMetricKey } from "@/backend/schemas/sec/metrics";
import type { TickerMetricSeries } from "@/backend/schemas/tickers/tickerMetricSeries";

type Row = {
  start: Date | string | null;
  end: Date | string;
  filed: Date | string | null;
  val: number | string;
  period_type: string;
  display_frame: string | null;
};

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

export async function getTickerMetricSeries(
  ticker: string,
  metricKey: SecMetricKey,
): Promise<TickerMetricSeries> {
  const normalizedTicker = normalizeTicker(ticker);

  const query = `
    SELECT
		  start,
      "end",
      filed,
      val,
      period_type,
      display_frame
    FROM sec_companyfact_series
    WHERE ticker = $1
      AND metric_key = $2
      AND period_type = 'quarterly'
    ORDER BY "end" ASC, filed ASC
  `;

  const { rows } = await db.query<Row>(query, [normalizedTicker, metricKey]);

  const points = rows
    .map((row) => ({
      start: row.start ? toIsoDate(row.start) : null,
      end: toIsoDate(row.end),
      filed: row.filed ? toIsoDate(row.filed) : null,
      val: Number(row.val),
      displayFrame: row.display_frame,
    }))
    .filter((point) => Number.isFinite(point.val));

  return {
    ticker: normalizedTicker,
    metricKey,
    points,
  };
}

function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}
