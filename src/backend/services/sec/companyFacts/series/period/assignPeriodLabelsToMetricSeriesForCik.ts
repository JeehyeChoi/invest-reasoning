// src/backend/services/sec/companyFacts/series/period/assignPeriodLabelsToMetricSeriesForCik.ts

import { db } from "@/backend/config/db";
import { loadCompanyFiscalProfile } from "@/backend/services/sec/companyFacts/series/fiscal/loadCompanyFiscalProfile";
import type { CanonicalMetricSeriesRow } from "@/backend/services/sec/companyFacts/series/metric/types";
import { buildPeriodResolveContext } from "@/backend/services/sec/companyFacts/series/period/resolveContext";
import { resolvePeriod } from "@/backend/services/sec/companyFacts/series/period/resolvePeriod";

type MetricSeriesDbRow = CanonicalMetricSeriesRow & {
  id: number;
};

type PeriodLabelUpdate = {
  id: number;
  fiscalYear: number | null;
  fiscalQuarter: number | null;
};

export async function assignPeriodLabelsToMetricSeriesForCik(input: {
  ticker: string;
  cik: string;
}): Promise<void> {
  const { cik } = input;

  const fiscalProfile = await loadCompanyFiscalProfile(cik);
  const periodContext = buildPeriodResolveContext(fiscalProfile);
  const rows = await getMetricSeriesRows(cik);

  if (rows.length === 0) {
    return;
  }

  const updates: PeriodLabelUpdate[] = [];

  for (const row of rows) {
    const resolved = resolvePeriod({
      row: shouldResolveFromMetricWindowOnly(row)
        ? {
          ...row,
          fy: null,
          fp: null,
          form: null,
          frame: null,
        }
        : row,
      fiscalProfile,
      periodContext,
    });

    updates.push({
      id: row.id,
      fiscalYear: resolved.fiscalYear,
      fiscalQuarter: resolved.fiscalQuarter,
    });
  }

  const dedupedUpdates = dedupeUpdates(updates);

  if (dedupedUpdates.length === 0) {
    return;
  }

  await updatePeriodLabels(dedupedUpdates);
}

async function getMetricSeriesRows(cik: string): Promise<MetricSeriesDbRow[]> {
  const result = await db.query<MetricSeriesDbRow>(
    `
    SELECT
      id,
      cik,
      ticker,
      metric_key,
      fact_type,
      unit,
      val,
      start,
      "end",
      duration_days,
      filed,
      accn,
      fy,
      fp,
      form,
      frame,
      fiscal_year,
      fiscal_quarter,
      period_type,
      build_source_kind,
      workflow_type
    FROM public.sec_companyfact_metric_series
    WHERE cik = $1
    ORDER BY
      metric_key ASC,
      unit ASC,
      "end" ASC,
      filed ASC
    `,
    [cik],
  );

  return result.rows.map((row) => ({
    ...row,
    val: Number(row.val),
    duration_days: row.duration_days == null ? null : Number(row.duration_days),
  }));
}

async function updatePeriodLabels(updates: PeriodLabelUpdate[]): Promise<void> {
  const values: unknown[] = [];

  const placeholders = updates.map((update, index) => {
    const offset = index * 3;

    values.push(update.id, update.fiscalYear, update.fiscalQuarter);

    return `($${offset + 1}::bigint, $${offset + 2}::int, $${offset + 3}::int)`;
  });

  await db.query(
    `
    UPDATE public.sec_companyfact_metric_series AS target
    SET
      fiscal_year = source.fiscal_year,
      fiscal_quarter = source.fiscal_quarter,
      updated_at = now()
    FROM (
      VALUES ${placeholders.join(",\n")}
    ) AS source(id, fiscal_year, fiscal_quarter)
    WHERE target.id = source.id
    `,
    values,
  );
}

function dedupeUpdates(updates: PeriodLabelUpdate[]): PeriodLabelUpdate[] {
  const byId = new Map<number, PeriodLabelUpdate>();

  for (const update of updates) {
    byId.set(update.id, update);
  }

  return Array.from(byId.values());
}

function shouldResolveFromMetricWindowOnly(row: MetricSeriesDbRow): boolean {
  return (
    row.build_source_kind === "annual_derived" ||
    row.build_source_kind === "cumulative_derived" ||
    row.build_source_kind === "segment_merged" ||
    row.build_source_kind === "other_merged"
  );
}
