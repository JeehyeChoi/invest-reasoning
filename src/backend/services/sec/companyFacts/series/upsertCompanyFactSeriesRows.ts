import { db } from "@/backend/config/db";
import type { BuiltTagSeriesRow } from "@/backend/services/sec/companyFacts/series/types";

export async function upsertCompanyFactSeriesRows(
  rows: BuiltTagSeriesRow[],
): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (const row of rows) {
    const baseIndex = values.length;

    values.push(
      row.cik,
      row.ticker,
      row.metric_key,
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
      row.display_frame,
      row.period_type,
      row.workflow_type,
    );

    placeholders.push(
      `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10}, $${baseIndex + 11}, $${baseIndex + 12}, $${baseIndex + 13}, $${baseIndex + 14}, $${baseIndex + 15}, $${baseIndex + 16})`,
    );
  }

  const query = `
    INSERT INTO sec_companyfact_series (
      cik,
      ticker,
      metric_key,
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
      display_frame,
      period_type,
      workflow_type
    )
    VALUES
      ${placeholders.join(",\n      ")}
		ON CONFLICT (cik, metric_key, period_type, display_frame)
    DO UPDATE SET
      ticker = EXCLUDED.ticker,
      fact_type = EXCLUDED.fact_type,
      unit = EXCLUDED.unit,
      val = EXCLUDED.val,
      start = EXCLUDED.start,
      filed = EXCLUDED.filed,
      accn = EXCLUDED.accn,
      fy = EXCLUDED.fy,
      fp = EXCLUDED.fp,
      form = EXCLUDED.form,
      display_frame = EXCLUDED.display_frame,
      period_type = EXCLUDED.period_type,
      workflow_type = EXCLUDED.workflow_type,
      updated_at = now()
  `;

  await db.query(query, values);
}
