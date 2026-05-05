import { db } from "@/backend/config/db";
import { buildFlowMetricSeriesEnrichedRows } from "@/backend/services/sec/companyFacts/series/enriched/buildFlowMetricSeriesEnrichedRows";
import { buildInstantMetricSeriesEnrichedRows } from "@/backend/services/sec/companyFacts/series/enriched/buildInstantMetricSeriesEnrichedRows";
import type {
  BuildMetricSeriesEnrichedInput,
  EnrichedMetricSeriesRow,
  MetricSeriesEnrichmentRow,
} from "@/backend/services/sec/companyFacts/series/enriched/types";
import type { SecMetricKey } from "@/shared/sec/metrics";
import type { PoolClient } from "pg";

type EnrichedPeriodType = "quarter" | "instant";
const ENRICHED_INSERT_COLUMN_COUNT = 41;
const ENRICHED_INSERT_CHUNK_SIZE = 1_000;

async function loadMetricKeysForCik(cik: string): Promise<SecMetricKey[]> {
  const result = await db.query<{ metric_key: SecMetricKey }>(
    `
    SELECT DISTINCT metric_key
    FROM sec_companyfact_metric_series
    WHERE cik = $1
    ORDER BY metric_key
    `,
    [cik],
  );

  return result.rows.map((row) => row.metric_key);
}

async function loadMetricSeries(input: {
  cik: string;
  metricKey: SecMetricKey;
  periodType: EnrichedPeriodType;
}): Promise<MetricSeriesEnrichmentRow[]> {
  const result = await db.query<MetricSeriesEnrichmentRow>(
    `
    SELECT
      cik,
      ticker,
      metric_key,
      source_tag,
      fact_type,
      unit,
      val,
      start,
      "end",
      fiscal_year,
      fiscal_quarter,
      period_type,
      duration_days
    FROM sec_companyfact_metric_series
    WHERE cik = $1
      AND metric_key = $2
      AND period_type = $3
    ORDER BY "end" ASC
    `,
    [input.cik, input.metricKey, input.periodType],
  );

  return result.rows;
}

async function upsertEnrichedRows(
  rows: EnrichedMetricSeriesRow[],
  client: Pick<PoolClient, "query"> = db,
): Promise<void> {
  if (rows.length === 0) return;

  for (let index = 0; index < rows.length; index += ENRICHED_INSERT_CHUNK_SIZE) {
    await upsertEnrichedRowsChunk(
      rows.slice(index, index + ENRICHED_INSERT_CHUNK_SIZE),
      client,
    );
  }
}

async function upsertEnrichedRowsChunk(
  rows: EnrichedMetricSeriesRow[],
  client: Pick<PoolClient, "query">,
): Promise<void> {
  const values: unknown[] = [];

  const placeholders = rows.map((row, index) => {
    const offset = index * ENRICHED_INSERT_COLUMN_COUNT;

    values.push(
      row.cik,
      row.ticker,
      row.metric_key,
      row.source_tag,
      row.fact_type,
      row.unit,
      row.val,
      row.start,
      row.end,
      row.fiscal_year,
      row.fiscal_quarter,
      row.period_type,
      row.duration_days,
      row.yoy,
      row.qoq,
      row.yoy_delta,
      row.ttm_val,
      row.ttm_yoy,
      row.ttm_delta,
      row.rolling4_avg,
      row.duration_adjusted_val,
      row.duration_adjusted_yoy,
      row.duration_adjusted_qoq,
      row.duration_adjusted_yoy_delta,
      row.duration_adjusted_ttm_val,
      row.duration_adjusted_ttm_yoy,
      row.duration_adjusted_ttm_delta,
      row.duration_adjusted_rolling4_avg,
      row.yoy_source_kind,
      row.yoy_base_period_end,
      row.qoq_source_kind,
      row.qoq_base_period_end,
      row.ttm_source_kind,
      row.ttm_window_start,
      row.ttm_window_end,
      row.ttm_yoy_source_kind,
      row.ttm_yoy_base_window_start,
      row.ttm_yoy_base_window_end,
      row.is_turnaround,
      row.is_deterioration,
      row.is_loss_narrowing,
    );

    return `(
      $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5},
      $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10},
      $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15},
      $${offset + 16}, $${offset + 17}, $${offset + 18}, $${offset + 19}, $${offset + 20},
      $${offset + 21}, $${offset + 22}, $${offset + 23}, $${offset + 24}, $${offset + 25},
      $${offset + 26}, $${offset + 27}, $${offset + 28}, $${offset + 29}, $${offset + 30},
      $${offset + 31}, $${offset + 32}, $${offset + 33}, $${offset + 34}, $${offset + 35},
      $${offset + 36}, $${offset + 37}, $${offset + 38}, $${offset + 39}, $${offset + 40},
      $${offset + 41}
    )`;
  });

  await client.query(
    `
    INSERT INTO sec_companyfact_metric_series_enriched (
      cik,
      ticker,
      metric_key,
      source_tag,
      fact_type,
      unit,
      val,
      start,
      "end",
      fiscal_year,
      fiscal_quarter,
      period_type,
      duration_days,
      yoy,
      qoq,
      yoy_delta,
      ttm_val,
      ttm_yoy,
      ttm_delta,
      rolling4_avg,
      duration_adjusted_val,
      duration_adjusted_yoy,
      duration_adjusted_qoq,
      duration_adjusted_yoy_delta,
      duration_adjusted_ttm_val,
      duration_adjusted_ttm_yoy,
      duration_adjusted_ttm_delta,
      duration_adjusted_rolling4_avg,
      yoy_source_kind,
      yoy_base_period_end,
      qoq_source_kind,
      qoq_base_period_end,
      ttm_source_kind,
      ttm_window_start,
      ttm_window_end,
      ttm_yoy_source_kind,
      ttm_yoy_base_window_start,
      ttm_yoy_base_window_end,
      is_turnaround,
      is_deterioration,
      is_loss_narrowing
    )
    VALUES ${placeholders.join(",")}
    ON CONFLICT (
      cik,
      metric_key,
      fact_type,
      unit,
      period_type,
      start,
      "end"
    )
    DO UPDATE SET
      ticker = EXCLUDED.ticker,
      source_tag = EXCLUDED.source_tag,
      val = EXCLUDED.val,
      fiscal_year = EXCLUDED.fiscal_year,
      fiscal_quarter = EXCLUDED.fiscal_quarter,
      duration_days = EXCLUDED.duration_days,
      yoy = EXCLUDED.yoy,
      qoq = EXCLUDED.qoq,
      yoy_delta = EXCLUDED.yoy_delta,
      ttm_val = EXCLUDED.ttm_val,
      ttm_yoy = EXCLUDED.ttm_yoy,
      ttm_delta = EXCLUDED.ttm_delta,
      rolling4_avg = EXCLUDED.rolling4_avg,
      duration_adjusted_val = EXCLUDED.duration_adjusted_val,
      duration_adjusted_yoy = EXCLUDED.duration_adjusted_yoy,
      duration_adjusted_qoq = EXCLUDED.duration_adjusted_qoq,
      duration_adjusted_yoy_delta = EXCLUDED.duration_adjusted_yoy_delta,
      duration_adjusted_ttm_val = EXCLUDED.duration_adjusted_ttm_val,
      duration_adjusted_ttm_yoy = EXCLUDED.duration_adjusted_ttm_yoy,
      duration_adjusted_ttm_delta = EXCLUDED.duration_adjusted_ttm_delta,
      duration_adjusted_rolling4_avg = EXCLUDED.duration_adjusted_rolling4_avg,
      yoy_source_kind = EXCLUDED.yoy_source_kind,
      yoy_base_period_end = EXCLUDED.yoy_base_period_end,
      qoq_source_kind = EXCLUDED.qoq_source_kind,
      qoq_base_period_end = EXCLUDED.qoq_base_period_end,
      ttm_source_kind = EXCLUDED.ttm_source_kind,
      ttm_window_start = EXCLUDED.ttm_window_start,
      ttm_window_end = EXCLUDED.ttm_window_end,
      ttm_yoy_source_kind = EXCLUDED.ttm_yoy_source_kind,
      ttm_yoy_base_window_start = EXCLUDED.ttm_yoy_base_window_start,
      ttm_yoy_base_window_end = EXCLUDED.ttm_yoy_base_window_end,
      is_turnaround = EXCLUDED.is_turnaround,
      is_deterioration = EXCLUDED.is_deterioration,
      is_loss_narrowing = EXCLUDED.is_loss_narrowing,
      updated_at = now()
    `,
    values,
  );
}

async function replaceEnrichedRowsForCik(input: {
  cik: string;
  metricKey?: SecMetricKey;
  rows: EnrichedMetricSeriesRow[];
}): Promise<void> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    if (input.metricKey) {
      await client.query(
        `
        DELETE FROM public.sec_companyfact_metric_series_enriched
        WHERE cik = $1
          AND metric_key = $2
        `,
        [input.cik, input.metricKey],
      );
    } else {
      await client.query(
        `DELETE FROM public.sec_companyfact_metric_series_enriched WHERE cik = $1`,
        [input.cik],
      );
    }

    await upsertEnrichedRows(input.rows, client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function buildCompanyFactsMetricSeriesEnrichedForCik(
  input: BuildMetricSeriesEnrichedInput,
): Promise<void> {
  const metricKeys = input.metricKey
    ? [input.metricKey]
    : await loadMetricKeysForCik(input.cik);
  const enrichedRows: EnrichedMetricSeriesRow[] = [];

  for (const metricKey of metricKeys) {
    const flowRows = await loadMetricSeries({
      cik: input.cik,
      metricKey,
      periodType: "quarter",
    });
    const instantRows = await loadMetricSeries({
      cik: input.cik,
      metricKey,
      periodType: "instant",
    });

    enrichedRows.push(
      ...buildFlowMetricSeriesEnrichedRows(flowRows),
      ...buildInstantMetricSeriesEnrichedRows(instantRows),
    );
  }

  await replaceEnrichedRowsForCik({
    cik: input.cik,
    metricKey: input.metricKey,
    rows: enrichedRows.map((row) => ({
      ...row,
      ticker: row.ticker ?? input.ticker,
    })),
  });
}
