import { db } from "@/backend/config/db";
import { buildCapexIncurredTickerPoints } from "@/backend/services/sec/companyFacts/series/metric/derived/buildCapexIncurredSeries";

import type { SecMetricKey } from "@/shared/sec/metrics";
import type { TickerMetricSeries } from "@/shared/tickers/tickerMetricSeries";

type Row = {
  start: Date | string | null;
  end: Date | string;
  filed: Date | string | null;
  val: number | string;
  period_type: string;
  duration_days: number | null;
  fiscal_year: number | null;
  fiscal_quarter: number | null;
  build_source_kind: string | null;
};

function normalizeTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

export async function getTickerMetricSeries(
  ticker: string,
  metricKey: SecMetricKey,
): Promise<TickerMetricSeries> {
  const normalizedTicker = normalizeTicker(ticker);

  if (metricKey === "capex_incurred") {
    const [cashSeries, unpaidSeries] = await Promise.all([
      loadTickerMetricQuarterPoints(normalizedTicker, "capex_cash"),
      loadTickerMetricQuarterPoints(normalizedTicker, "capex_unpaid"),
    ]);

    return {
      ticker: normalizedTicker,
      metricKey,
      points: buildCapexIncurredTickerPoints(cashSeries, unpaidSeries),
    };
  }

  return {
    ticker: normalizedTicker,
    metricKey,
    points: await loadTickerMetricQuarterPoints(normalizedTicker, metricKey),
  };
}

async function loadTickerMetricQuarterPoints(
  normalizedTicker: string,
  metricKey: SecMetricKey,
) {
  const query = `
		SELECT
			start,
			"end",
			filed,
			val,
			period_type,
			duration_days,
			fiscal_year,
			fiscal_quarter,
      build_source_kind
    FROM sec_companyfact_metric_series
    WHERE ticker = $1
      AND metric_key = $2
      AND period_type = 'quarter'
    ORDER BY "end" ASC, filed ASC
  `;

  const { rows } = await db.query<Row>(query, [normalizedTicker, metricKey]);

  return rows
    .map((row) => ({
      start: row.start ? toIsoDate(row.start) : null,
      end: toIsoDate(row.end),
      filed: row.filed ? toIsoDate(row.filed) : null,
      val: Number(row.val),
      durationDays: row.duration_days,
      fiscalYear: row.fiscal_year,
      fiscalQuarter: row.fiscal_quarter,
      buildSourceKind: row.build_source_kind,
    }))
    .filter((point) => Number.isFinite(point.val));
}

function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}
