import { db } from "@/backend/config/db";

import type { FactorAxisKey } from "@/shared/factors/axes";
import type { FactorKey } from "@/shared/factors/factors";
import type { TickerMetricSeries } from "@/shared/tickers/tickerMetricSeries";

type Row = {
  period_end: Date | string;
  effective_date: Date | string;
  feature_value: number | string;
};

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

export async function getTickerFactorFeatureSeries(input: {
  ticker: string;
  factor: FactorKey;
  axis: FactorAxisKey;
  metricKey: string;
  featureKey: string;
}): Promise<TickerMetricSeries> {
  const normalizedTicker = normalizeTicker(input.ticker);

  const query = `
    WITH ticker_identity AS (
      SELECT cik
      FROM public.ticker_identities
      WHERE ticker = $1
      LIMIT 1
    )
    SELECT
      period_end,
      effective_date,
      feature_value
    FROM public.ticker_factor_metric_features
    WHERE (
        cik = (SELECT cik FROM ticker_identity)
        OR (
          (SELECT cik FROM ticker_identity) IS NULL
          AND ticker = $1
        )
      )
      AND factor = $2
      AND axis = $3
      AND metric_key = $4
      AND feature_key = $5
    ORDER BY period_end ASC, effective_date ASC
  `;

  const { rows } = await db.query<Row>(query, [
    normalizedTicker,
    input.factor,
    input.axis,
    input.metricKey,
    input.featureKey,
  ]);

  return {
    ticker: normalizedTicker,
    metricKey: input.metricKey,
    points: rows
      .map((row) => ({
        start: null,
        end: toIsoDate(row.period_end),
        filed: toIsoDate(row.effective_date),
        val: Number(row.feature_value),
        periodType: "snapshot",
        durationDays: null,
        fiscalYear: null,
        fiscalQuarter: null,
        buildSourceKind: "factor_feature",
        rolling4Avg: null,
      }))
      .filter((point) => Number.isFinite(point.val)),
  };
}

function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}
