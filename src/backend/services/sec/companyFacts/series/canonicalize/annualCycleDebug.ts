import type { FlatCompanyFactRow } from "@/backend/schemas/sec/companyFacts";
import type { BuiltTagSeriesRow } from "@/backend/services/sec/companyFacts/series/types";
import type { FlowPeriodProfile } from "@/backend/services/sec/companyFacts/series/canonicalize/flowPeriod";
import { classifyRawFlowPeriodType } from "@/backend/services/sec/companyFacts/series/canonicalize/flowPeriod";

export function summarizeSeriesRow(row: BuiltTagSeriesRow) {
  return {
    start: row.start,
    end: row.end,
    val: row.val,
    fy: row.fy,
    fp: row.fp,
    form: row.form,
    display_frame: row.display_frame,
    workflow_type: row.workflow_type,
  };
}

export function summarizeRawPoint(
  point: FlatCompanyFactRow & { end: string; val: number },
  profile?: FlowPeriodProfile | null,
) {
  return {
    start: point.start,
    end: point.end,
    val: point.val,
    fy: point.fy,
    fp: point.fp,
    form: point.form,
    frame: point.frame,
    rawPeriodType: classifyRawFlowPeriodType(point.start, point.end, profile),
  };
}
