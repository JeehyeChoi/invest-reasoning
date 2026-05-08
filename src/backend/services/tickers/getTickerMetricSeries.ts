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
  rolling4_avg: number | string | null;
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
      loadTickerMetricPointsByPeriod(normalizedTicker, "capex_cash", "quarter"),
      loadTickerMetricPointsByPeriod(normalizedTicker, "capex_unpaid", "quarter"),
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
    points: await loadTickerMetricDisplayPoints(normalizedTicker, metricKey),
  };
}

async function loadTickerMetricDisplayPoints(
  normalizedTicker: string,
  metricKey: SecMetricKey,
) {
  const quarterPoints = await loadTickerMetricPointsByPeriod(
    normalizedTicker,
    metricKey,
    "quarter",
  );

  if (quarterPoints.length > 0) {
    return quarterPoints;
  }

  return loadTickerMetricPointsByPeriod(normalizedTicker, metricKey, "instant");
}

async function loadTickerMetricPointsByPeriod(
  normalizedTicker: string,
  metricKey: SecMetricKey,
  periodType: "quarter" | "instant",
) {
  const query = `
    WITH ticker_identity AS (
      SELECT cik
      FROM public.ticker_identities
      WHERE ticker = $1
      LIMIT 1
    )
		SELECT
			m.start,
			m."end",
			m.filed,
			m.val,
			m.period_type,
			m.duration_days,
			m.fiscal_year,
			m.fiscal_quarter,
      m.build_source_kind,
      e.rolling4_avg
    FROM sec_companyfact_metric_series m
    LEFT JOIN sec_companyfact_metric_series_enriched e
      ON e.cik = m.cik
      AND e.metric_key = m.metric_key
      AND e.fact_type = m.fact_type
      AND e.unit = m.unit
      AND e.period_type = m.period_type
      AND e.start IS NOT DISTINCT FROM m.start
      AND e."end" = m."end"
    WHERE (
        m.cik = (SELECT cik FROM ticker_identity)
        OR (
          (SELECT cik FROM ticker_identity) IS NULL
          AND m.ticker = $1
        )
      )
      AND m.metric_key = $2
      AND m.period_type = $3
    ORDER BY m."end" ASC, m.filed ASC
  `;

  const { rows } = await db.query<Row>(query, [
    normalizedTicker,
    metricKey,
    periodType,
  ]);

  return rows
    .map((row) => ({
      start: row.start ? toIsoDate(row.start) : null,
      end: toIsoDate(row.end),
      filed: row.filed ? toIsoDate(row.filed) : null,
      val: Number(row.val),
      periodType: row.period_type,
      durationDays: row.duration_days,
      fiscalYear: row.fiscal_year,
      fiscalQuarter: row.fiscal_quarter,
      buildSourceKind: row.build_source_kind,
      rolling4Avg:
        row.rolling4_avg == null ? null : Number(row.rolling4_avg),
    }))
    .filter((point) => Number.isFinite(point.val));
}

function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}
