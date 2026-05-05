// src/backend/services/sec/companyFacts/series/validation/runValidateMetricSeriesForCik.ts
import fs from "fs/promises";
import path from "path";
import { db } from "@/backend/config/db";
import { FACTOR_BLUEPRINTS } from "@/backend/config/factors/blueprints";
import type { FactorKey } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { SecMetricKey } from "@/shared/sec/metrics";
import { shouldValidateSecMetricKey } from "@/backend/config/sec/metrics";
import type { SeriesValidationRow } from "@/backend/services/sec/companyFacts/series/validation/types";
import { validateMetricSeries } from "@/backend/services/sec/companyFacts/series/validation/validateMetricSeries";
import { buildSeriesValidationReport } from "@/backend/services/sec/companyFacts/series/validation/buildSeriesValidationReport";

const OUTPUT_DIR = path.join(
  process.cwd(),
  "data/sec/validation/companyfacts",
);

export async function runValidateMetricSeriesForCik(input: {
  ticker: string;
  cik: string;
}) {
  const { ticker, cik } = input;

  const [rows, activeMetricKeys] = await Promise.all([
    loadMetricSeriesRows(cik),
    loadActiveMetricKeys(),
  ]);

  const filteredRows = rows.filter((row) => activeMetricKeys.has(row.metric_key));

  const result = validateMetricSeries({
    cik,
    ticker,
    rows: filteredRows,
  });

  const report = buildSeriesValidationReport(result);

  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const filePath = path.join(
    OUTPUT_DIR,
    `${ticker}-${cik}.json`,
  );

  await fs.writeFile(
    filePath,
    JSON.stringify(report, null, 2),
    "utf8",
  );

  return {
    filePath,
    report,
  };
}

async function loadActiveMetricKeys(): Promise<Set<string>> {
  const activeMetricKeys = new Set<string>();

  for (const factor of Object.keys(FACTOR_BLUEPRINTS) as FactorKey[]) {
    const factorBlueprint = FACTOR_BLUEPRINTS[factor];
    if (!factorBlueprint) continue;

    for (const axis of Object.keys(factorBlueprint) as FactorAxisKey[]) {
      const axisBlueprint = factorBlueprint[axis];
      if (!axisBlueprint) continue;

      for (const metricKey of axisBlueprint.metricKeys as SecMetricKey[]) {
        if (shouldValidateSecMetricKey(metricKey)) {
          activeMetricKeys.add(metricKey);
        }
      }
    }
  }

  return activeMetricKeys;
}

async function loadMetricSeriesRows(
  cik: string,
): Promise<SeriesValidationRow[]> {
  const result = await db.query<SeriesValidationRow>(
    `
    SELECT
      m.cik,
      m.ticker,
      m.metric_key,
      m.source_tag,
      m.fact_type,
      m.unit,
      m.val,
      m.start,
      m."end",
      m.duration_days,
      m.fiscal_year,
      m.fiscal_quarter,
      m.period_type,
      m.build_source_kind,
      m.workflow_type,
      sp.sign_profile,
      sp.expected_sign,
      sp.confidence AS sign_profile_confidence,
      m.accn,
      m.filed
    FROM public.sec_companyfact_metric_series m
    LEFT JOIN public.sec_company_fiscal_metric_sign_profiles sp
      ON sp.cik = m.cik
      AND sp.metric_key = m.metric_key
      AND sp.tag = m.source_tag
      AND sp.unit = m.unit
    WHERE m.cik = $1
    ORDER BY
      m.metric_key ASC,
      m.unit ASC,
      m.fiscal_year ASC NULLS LAST,
      m.fiscal_quarter ASC NULLS LAST,
      m."end" ASC NULLS LAST
    `,
    [cik],
  );

  return result.rows.map((row) => ({
    ...row,
    val: row.val == null ? null : Number(row.val),
    duration_days:
      row.duration_days == null ? null : Number(row.duration_days),
    sign_profile_confidence:
      row.sign_profile_confidence == null
        ? null
        : Number(row.sign_profile_confidence),
  }));
}
