// src/backend/services/factors/growth/fundamentals_based/resolveFlowMetricSeries.ts

import { db } from "@/backend/config/db";

export type FlowMetricSeriesPoint = {
  end: string;
  filed: string | null;
  val: number;
  periodType: string;
  displayFrame: string | null;
};

type ResolveFlowMetricSeriesInput = {
  cik: string;
  metricKey: string;
  periodType?: "quarterly" | "annual";
};

type QueryRow = {
  end: Date | string;
  filed: Date | string | null;
  val: number | string;
  period_type: string;
  display_frame: string | null;
};

export async function resolveFlowMetricSeries({
  cik,
  metricKey,
  periodType = "quarterly",
}: ResolveFlowMetricSeriesInput): Promise<FlowMetricSeriesPoint[]> {
  const query = `
    SELECT
      "end",
      filed,
      val,
      period_type,
      display_frame
    FROM sec_companyfact_series
    WHERE cik = $1
      AND metric_key = $2
      AND period_type = $3
    ORDER BY "end" ASC, filed ASC
  `;

  const { rows } = await db.query<QueryRow>(query, [
    cik,
    metricKey,
    periodType,
  ]);

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
