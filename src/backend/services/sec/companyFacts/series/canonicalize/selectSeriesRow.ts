import type { FlatCompanyFactRow } from "@/backend/schemas/sec/companyFacts";
import type {
  BuildTagSeriesInput,
  BuiltTagSeriesRow,
} from "@/backend/services/sec/companyFacts/series/types";

export function buildBaseRow(
  point: FlatCompanyFactRow & { end: string; val: number },
  input: BuildTagSeriesInput,
): Omit<BuiltTagSeriesRow, "display_frame" | "period_type"> {
  if (!input.metricKey) {
    throw new Error(
      `buildTagSeries missing metricKey for ticker=${input.ticker}`,
    );
  }

  return {
    cik: point.cik,
    ticker: input.ticker,
    metric_key: input.metricKey,
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
  };
}

export function buildSeriesKey(row: BuiltTagSeriesRow): string {
  return [
    row.cik,
    row.metric_key,
    row.period_type,
    row.start ?? "",
    row.end,
  ].join("__");
}

export function upsertLatestByKey(
  map: Map<string, BuiltTagSeriesRow>,
  key: string,
  candidate: BuiltTagSeriesRow,
) {
  const existing = map.get(key);

  if (!existing) {
    map.set(key, candidate);
    return;
  }

  if (shouldReplaceSeriesRow(existing, candidate)) {
    map.set(key, candidate);
  }
}

export function shouldReplaceSeriesRow(
  existing: BuiltTagSeriesRow,
  candidate: BuiltTagSeriesRow,
): boolean {
  const existingPriority = getSeriesRowPriority(existing);
  const candidatePriority = getSeriesRowPriority(candidate);

  if (candidatePriority !== existingPriority) {
    return candidatePriority > existingPriority;
  }

  return isFiledNewer(candidate, existing);
}

export function getSeriesRowPriority(row: BuiltTagSeriesRow): number {
  if (row.workflow_type === "sec_companyfacts_reconstructed_v1") {
    return 10;
  }

  return 100;
}

export function isFiledNewer(
  candidate: Pick<BuiltTagSeriesRow, "filed">,
  existing: Pick<BuiltTagSeriesRow, "filed">,
): boolean {
  const existingFiled = existing.filed ? new Date(existing.filed).getTime() : 0;
  const currentFiled = candidate.filed ? new Date(candidate.filed).getTime() : 0;

  return currentFiled >= existingFiled;
}

export function sortSeriesRows(rows: BuiltTagSeriesRow[]): BuiltTagSeriesRow[] {
  return rows.sort((a, b) => {
    const aEnd = new Date(a.end).getTime();
    const bEnd = new Date(b.end).getTime();

    if (aEnd !== bEnd) {
      return aEnd - bEnd;
    }

    const aFiled = a.filed ? new Date(a.filed).getTime() : 0;
    const bFiled = b.filed ? new Date(b.filed).getTime() : 0;

    return aFiled - bFiled;
  });
}
