import type { FlatCompanyFactRow } from "@/backend/schemas/sec/companyFacts";
import type {
  BuildTagSeriesInput,
  BuiltTagSeriesRow,
} from "@/backend/services/sec/companyFacts/series/types";

import {
  buildSeriesKey,
  upsertLatestByKey,
} from "@/backend/services/sec/companyFacts/series/canonicalize/selectSeriesRow";

export function buildInstantSeries(
  points: Array<FlatCompanyFactRow & { end: string; val: number }>,
  input: BuildTagSeriesInput,
): BuiltTagSeriesRow[] {
  const map = new Map<string, BuiltTagSeriesRow>();

  for (const point of points) {
    const row: BuiltTagSeriesRow = {
      cik: point.cik,
      ticker: input.ticker,
      metric_key: input.metricKey!,
      fact_type: input.factType,
      unit: point.unit,
      val: point.val,
      start: point.start,
      end: point.end,
      filed: point.filed,
      accn: point.accn,
      fy: point.fy,
      fp: point.fp,
      form: point.form,
      workflow_type: point.workflow_type,

      display_frame: null,
      period_type: "instant",
    };

    upsertLatestByKey(map, buildSeriesKey(row), row);
  }

  return Array.from(map.values()).sort((a, b) => {
    return new Date(a.end).getTime() - new Date(b.end).getTime();
  });
}
