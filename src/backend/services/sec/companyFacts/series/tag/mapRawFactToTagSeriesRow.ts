import type { FlatCompanyFactRow } from "@/backend/services/sec/companyFacts/raw/types";
import type {
  CompanyFactTagMeta,
  CompanyFactTagSeriesRow,
} from "@/backend/services/sec/companyFacts/series/tag/types";
import { calculateDurationDays } from "@/backend/services/sec/companyFacts/series/utils/duration";

export function mapRawFactToTagSeriesRow(input: {
  point: FlatCompanyFactRow;
  ticker: string;
  tagMeta: CompanyFactTagMeta;
  workflowType?: string;
}): CompanyFactTagSeriesRow | null {
  const { point, ticker, tagMeta } = input;

  if (point.val === null || point.end === null) {
    return null;
  }

  return {
    cik: point.cik,
    ticker,
    tag: point.tag,
    metric_key: tagMeta.metricKey,
    priority: tagMeta.priority ?? 99,
    fact_type: tagMeta.factType,
    unit: point.unit,
    val: Number(point.val),
    start: point.start,
    end: point.end,
    filed: point.filed,
    accn: point.accn,
    fy: point.fy,
    fp: point.fp,
    form: point.form,
    frame: point.frame,
    duration_days: calculateDurationDays(point.start, point.end),
    workflow_type: input.workflowType ?? point.workflow_type,
  };
}
