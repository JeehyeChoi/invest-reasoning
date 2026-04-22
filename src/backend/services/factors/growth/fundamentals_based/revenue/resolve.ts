import { db } from "@/backend/config/db";

export type RevenueSeriesPoint = {
  end: string;
  filed: string | null;
  val: number;
  periodType: string;
  displayFrame: string | null;
};

type ResolveRevenueSeriesInput = {
  cik: string;
};

type QueryRow = {
  end: Date | string;
  filed: Date | string | null;
  val: number | string;
  period_type: string;
  display_frame: string | null;
};

export async function resolve({
  cik,
}: ResolveRevenueSeriesInput): Promise<RevenueSeriesPoint[]> {
  const query = `
    SELECT
      "end",
      filed,
      val,
      period_type,
      display_frame
    FROM sec_companyfact_series
    WHERE cik = $1
      AND metric_key = 'revenue'
      AND period_type = 'quarterly'
    ORDER BY "end" ASC, filed ASC
  `;

  const { rows } = await db.query<QueryRow>(query, [cik]);

  return rows
    .map((row) => ({
      end: toIsoDate(row.end),
      filed: row.filed ? toIsoDate(row.filed) : null,
      val: Number(row.val),
      periodType: row.period_type,
      displayFrame: row.display_frame,
    }))
    .filter((row) => Number.isFinite(row.val));
}

function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}
