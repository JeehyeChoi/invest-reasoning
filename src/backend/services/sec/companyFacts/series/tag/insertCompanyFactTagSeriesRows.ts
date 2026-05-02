import { db } from "@/backend/config/db";
import type { PoolClient } from "pg";

import type { CompanyFactTagSeriesRow } from "@/backend/services/sec/companyFacts/series/tag/types";

async function insertCompanyFactTagSeriesRowsChunk(
  rows: CompanyFactTagSeriesRow[],
  executor: Pick<PoolClient, "query">,
): Promise<void> {
  const values: unknown[] = [];

  const placeholders = rows.map((row, index) => {
    const offset = index * 19;

    values.push(
      row.cik,
      row.ticker,
      row.tag,
      row.metric_key,
      row.priority,
      row.fact_type,
      row.unit,
      row.val,
      row.start,
      row.end,
      row.filed,
      row.accn,
      row.fy,
      row.fp,
      row.form,
      row.frame,
      row.duration_days,
      row.workflow_type,
      new Date(),
    );

    return `(
      $${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4},
      $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8},
      $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12},
      $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16},
      $${offset + 17}, $${offset + 18}, $${offset + 19}
    )`;
  });

  await executor.query(
    `
    INSERT INTO public.sec_companyfact_tag_series (
      cik,
      ticker,
      tag,
      metric_key,
      priority,
      fact_type,
      unit,
      val,
      start,
      "end",
      filed,
      accn,
      fy,
      fp,
      form,
      frame,
      duration_days,
      workflow_type,
      updated_at
    )
    VALUES ${placeholders.join(",")}
    ON CONFLICT ON CONSTRAINT sec_companyfact_tag_series_unique_point
    DO UPDATE SET
      ticker = EXCLUDED.ticker,
      metric_key = EXCLUDED.metric_key,
      priority = EXCLUDED.priority,
      fact_type = EXCLUDED.fact_type,
      unit = EXCLUDED.unit,
      val = EXCLUDED.val,
      filed = EXCLUDED.filed,
      accn = EXCLUDED.accn,
      fy = EXCLUDED.fy,
      fp = EXCLUDED.fp,
      form = EXCLUDED.form,
      frame = EXCLUDED.frame,
      duration_days = EXCLUDED.duration_days,
      workflow_type = EXCLUDED.workflow_type,
      updated_at = EXCLUDED.updated_at
    `,
    values,
  );
}

export async function insertCompanyFactTagSeriesRows(
  rows: CompanyFactTagSeriesRow[],
  executor: Pick<PoolClient, "query"> = db,
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const chunkSize = 500;

  for (let i = 0; i < rows.length; i += chunkSize) {
    await insertCompanyFactTagSeriesRowsChunk(
      rows.slice(i, i + chunkSize),
      executor,
    );
  }
}
