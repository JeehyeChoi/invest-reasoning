import { db } from "@/backend/config/db";
import type { PoolClient } from "pg";
import type { CanonicalMetricSeriesRow } from "@/backend/services/sec/companyFacts/series/metric/types";
import { toDateKey } from "@/backend/services/sec/companyFacts/series/utils/dateKey";

export type CompanyFactMetricSeriesTargetTable =
  | "sec_companyfact_metric_series"
  | "sec_companyfact_metric_series_experiment";

function resolveTargetTableName(table: CompanyFactMetricSeriesTargetTable) {
  switch (table) {
    case "sec_companyfact_metric_series":
      return "public.sec_companyfact_metric_series";
    case "sec_companyfact_metric_series_experiment":
      return "public.sec_companyfact_metric_series_experiment";
  }
}

function normalizeStringKeyPart(value: string | null | undefined): string {
  return value?.trim() || "NULL";
}

function normalizeDateKeyPart(value: string | Date | null | undefined): string {
  const key = toDateKey(value);
  return key || "NULL";
}

function buildUpsertConflictKey(row: CanonicalMetricSeriesRow): string {
  return [
    normalizeStringKeyPart(row.cik),
    normalizeStringKeyPart(row.metric_key),
    normalizeStringKeyPart(row.unit),
    normalizeStringKeyPart(row.period_type),
    normalizeDateKeyPart(row.start),
    normalizeDateKeyPart(row.end),
  ].join("__");
}

function dedupeRowsForUpsert(
  rows: CanonicalMetricSeriesRow[],
): CanonicalMetricSeriesRow[] {
  const deduped = new Map<string, CanonicalMetricSeriesRow>();

  for (const row of rows) {
    deduped.set(buildUpsertConflictKey(row), row);
  }

  return Array.from(deduped.values());
}

export async function upsertCompanyFactMetricSeriesRows(
  rows: CanonicalMetricSeriesRow[],
  executor: Pick<PoolClient, "query"> = db,
  targetTable: CompanyFactMetricSeriesTargetTable =
    "sec_companyfact_metric_series",
): Promise<void> {
  if (rows.length === 0) return;

  const dedupedRows = dedupeRowsForUpsert(rows);
  if (dedupedRows.length === 0) return;

  const values: unknown[] = [];

  const placeholders = dedupedRows.map((row, index) => {
    const offset = index * 23;

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
      row.duration_days,
      row.filed,
      row.effective_date,
      row.accn,
      row.fy,
      row.fp,
      row.form,
      row.frame,
      row.fiscal_year,
      row.fiscal_quarter,
      row.period_type,
      row.build_source_kind,
      row.workflow_type,
      new Date(),
    );

    return `(
      $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4},
      $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8},
      $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12},
      $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16},
      $${offset + 17}, $${offset + 18}, $${offset + 19}, $${offset + 20},
      $${offset + 21}, $${offset + 22}, $${offset + 23}
    )`;
  });

  const query = `
    INSERT INTO ${resolveTargetTableName(targetTable)} (
      cik,
      ticker,
      metric_key,
      source_tag,
      fact_type,
      unit,
      val,
      start,
      "end",
      duration_days,
      filed,
      effective_date,
      accn,
      fy,
      fp,
      form,
      frame,
      fiscal_year,
      fiscal_quarter,
      period_type,
      build_source_kind,
      workflow_type,
      updated_at
    )
    VALUES ${placeholders.join(",\n")}
    ON CONFLICT (cik, metric_key, unit, period_type, start, "end")
    DO UPDATE SET
      ticker = EXCLUDED.ticker,
      source_tag = EXCLUDED.source_tag,
      fact_type = EXCLUDED.fact_type,
      val = EXCLUDED.val,
      filed = EXCLUDED.filed,
      effective_date = EXCLUDED.effective_date,
      accn = EXCLUDED.accn,
      fy = EXCLUDED.fy,
      fp = EXCLUDED.fp,
      form = EXCLUDED.form,
      frame = EXCLUDED.frame,
      duration_days = EXCLUDED.duration_days,
      fiscal_year = EXCLUDED.fiscal_year,
      fiscal_quarter = EXCLUDED.fiscal_quarter,
      build_source_kind = EXCLUDED.build_source_kind,
      workflow_type = EXCLUDED.workflow_type,
      updated_at = EXCLUDED.updated_at
  `;

  await executor.query(query, values);
}
