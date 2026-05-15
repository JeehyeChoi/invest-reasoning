import { db } from "@/backend/config/db";
import type { SecMetricKey } from "@/shared/sec/metrics";
import {
  METRIC_SERIES_RELIABILITY_DEFINITION_BY_KEY,
  type MetricSeriesReliabilityKey,
} from "@/shared/sec/metricSeriesReliability";
import { requireDateKey } from "@/backend/services/sec/companyFacts/series/utils/dateKey";
import type { PoolClient } from "pg";

type Input = {
  ticker: string;
  cik: string;
  metricKey?: SecMetricKey;
};

type EnrichedMetricSeriesRow = {
  ticker: string | null;
  cik: string;
  metric_key: SecMetricKey;
  end: Date | string;
  fiscal_year: number | null;
  fiscal_quarter: number | null;
  period_type: string;
  val: number | null;
  yoy: number | null;
  qoq: number | null;
  ttm_val: number | null;
  rolling4_avg: number | null;
  duration_adjusted_val: number | null;
  duration_adjusted_yoy: number | null;
  duration_adjusted_qoq: number | null;
  duration_adjusted_ttm_val: number | null;
  duration_adjusted_rolling4_avg: number | null;
};

type MetricSeriesReliabilityRow = {
  ticker: string;
  cik: string;
  metric_key: SecMetricKey;
  reliability_key: MetricSeriesReliabilityKey;
  reliability_value: number;
  period_end: string;
  effective_date: string;
  source_table: string;
  source_version: string;
};

const SOURCE_TABLE = "sec_companyfact_metric_series_enriched";
const SOURCE_VERSION = "metric_series_reliability_v0";
const OBSERVATION_DEPTH_LOOKBACK = 8;
const CONTINUITY_LOOKBACK = 8;
const RELIABILITY_KEY = {
  observationDepth:
    METRIC_SERIES_RELIABILITY_DEFINITION_BY_KEY.seriesObservationDepth.key,
  fiscalContinuity:
    METRIC_SERIES_RELIABILITY_DEFINITION_BY_KEY.seriesFiscalContinuity.key,
  inputCoverage:
    METRIC_SERIES_RELIABILITY_DEFINITION_BY_KEY.seriesInputCoverage.key,
} as const;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function quarterIndex(row: EnrichedMetricSeriesRow): number | null {
  if (row.fiscal_year == null || row.fiscal_quarter == null) return null;
  return row.fiscal_year * 4 + row.fiscal_quarter;
}

function calcObservationDepth(index: number): number {
  return Math.min(1, (index + 1) / OBSERVATION_DEPTH_LOOKBACK);
}

function calcContinuityRatio(input: {
  rows: EnrichedMetricSeriesRow[];
  currentIndex: number;
}): number | null {
  const startIndex = Math.max(0, input.currentIndex - CONTINUITY_LOOKBACK + 1);
  const window = input.rows.slice(startIndex, input.currentIndex + 1);

  if (window.length < 2) return null;

  let observedTransitions = 0;
  let continuousTransitions = 0;

  for (let index = 1; index < window.length; index += 1) {
    const previous = quarterIndex(window[index - 1]);
    const current = quarterIndex(window[index]);

    if (previous == null || current == null) continue;

    observedTransitions += 1;
    if (current - previous === 1) continuousTransitions += 1;
  }

  if (observedTransitions === 0) return null;
  return continuousTransitions / observedTransitions;
}

function calcSignalInputCoverage(row: EnrichedMetricSeriesRow): number {
  const values = [
    row.val,
    row.yoy,
    row.qoq,
    row.ttm_val,
    row.rolling4_avg,
    row.duration_adjusted_val,
    row.duration_adjusted_yoy,
    row.duration_adjusted_qoq,
    row.duration_adjusted_ttm_val,
    row.duration_adjusted_rolling4_avg,
  ];

  const validCount = values.filter(isFiniteNumber).length;
  return validCount / values.length;
}

function buildReliabilityRows(input: {
  ticker: string;
  cik: string;
  rows: EnrichedMetricSeriesRow[];
}): MetricSeriesReliabilityRow[] {
  const output: MetricSeriesReliabilityRow[] = [];

  input.rows.forEach((row, index) => {
    const periodEnd = requireDateKey(row.end);
    const common = {
      ticker: row.ticker ?? input.ticker,
      cik: input.cik,
      metric_key: row.metric_key,
      period_end: periodEnd,
      effective_date: periodEnd,
      source_table: SOURCE_TABLE,
      source_version: SOURCE_VERSION,
    };

    output.push({
      ...common,
      reliability_key: RELIABILITY_KEY.observationDepth,
      reliability_value: calcObservationDepth(index),
    });

    const continuityRatio = calcContinuityRatio({
      rows: input.rows,
      currentIndex: index,
    });

    if (continuityRatio !== null) {
      output.push({
        ...common,
        reliability_key: RELIABILITY_KEY.fiscalContinuity,
        reliability_value: continuityRatio,
      });
    }

    output.push({
      ...common,
      reliability_key: RELIABILITY_KEY.inputCoverage,
      reliability_value: calcSignalInputCoverage(row),
    });
  });

  return output;
}

function groupRowsByMetric(
  rows: EnrichedMetricSeriesRow[],
): Map<SecMetricKey, EnrichedMetricSeriesRow[]> {
  const grouped = new Map<SecMetricKey, EnrichedMetricSeriesRow[]>();

  for (const row of rows) {
    const metricRows = grouped.get(row.metric_key) ?? [];
    metricRows.push(row);
    grouped.set(row.metric_key, metricRows);
  }

  return grouped;
}

async function loadEnrichedRows(input: {
  cik: string;
  metricKey?: SecMetricKey;
}): Promise<EnrichedMetricSeriesRow[]> {
  const result = await db.query<EnrichedMetricSeriesRow>(
    `
    SELECT
      ticker,
      cik,
      metric_key,
      "end",
      fiscal_year,
      fiscal_quarter,
      period_type,
      val,
      yoy,
      qoq,
      ttm_val,
      rolling4_avg,
      duration_adjusted_val,
      duration_adjusted_yoy,
      duration_adjusted_qoq,
      duration_adjusted_ttm_val,
      duration_adjusted_rolling4_avg
    FROM public.sec_companyfact_metric_series_enriched
    WHERE cik = $1
      AND ($2::text IS NULL OR metric_key = $2)
      AND period_type = 'quarter'
    ORDER BY metric_key ASC, "end" ASC
    `,
    [input.cik, input.metricKey ?? null],
  );

  return result.rows;
}

async function upsertReliabilityRows(
  rows: MetricSeriesReliabilityRow[],
  client: Pick<PoolClient, "query"> = db,
): Promise<void> {
  if (rows.length === 0) return;

  const values: unknown[] = [];
  const placeholders = rows.map((row, index) => {
    const offset = index * 9;

    values.push(
      row.ticker,
      row.cik,
      row.metric_key,
      row.reliability_key,
      row.reliability_value,
      row.period_end,
      row.effective_date,
      row.source_table,
      row.source_version,
    );

    return `(
      $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4},
      $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8},
      $${offset + 9}
    )`;
  });

  await client.query(
    `
    INSERT INTO public.ticker_metric_series_reliability (
      ticker,
      cik,
      metric_key,
      reliability_key,
      reliability_value,
      period_end,
      effective_date,
      source_table,
      source_version
    )
    VALUES ${placeholders.join(",")}
    ON CONFLICT (
      ticker,
      metric_key,
      reliability_key,
      period_end,
      effective_date
    )
    DO UPDATE SET
      cik = EXCLUDED.cik,
      reliability_value = EXCLUDED.reliability_value,
      source_table = EXCLUDED.source_table,
      source_version = EXCLUDED.source_version,
      updated_at = now()
    `,
    values,
  );
}

async function replaceReliabilityRowsForCik(input: {
  ticker: string;
  cik: string;
  metricKey?: SecMetricKey;
  rows: MetricSeriesReliabilityRow[];
}): Promise<void> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      DELETE FROM public.ticker_metric_series_reliability
      WHERE (ticker = $1 OR cik = $2)
        AND ($3::text IS NULL OR metric_key = $3)
      `,
      [input.ticker, input.cik, input.metricKey ?? null],
    );

    await upsertReliabilityRows(input.rows, client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function buildMetricSeriesReliabilityForCik(
  input: Input,
): Promise<{ reliabilityCount: number; metricCount: number }> {
  const rows = await loadEnrichedRows({
    cik: input.cik,
    metricKey: input.metricKey,
  });
  const rowsByMetric = groupRowsByMetric(rows);
  const reliabilityRows = [...rowsByMetric.values()].flatMap((metricRows) =>
    buildReliabilityRows({
      ticker: input.ticker,
      cik: input.cik,
      rows: metricRows,
    }),
  );

  await replaceReliabilityRowsForCik({
    ticker: input.ticker,
    cik: input.cik,
    metricKey: input.metricKey,
    rows: reliabilityRows,
  });

  return {
    reliabilityCount: reliabilityRows.length,
    metricCount: rowsByMetric.size,
  };
}
