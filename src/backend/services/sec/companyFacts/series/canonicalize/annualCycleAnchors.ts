import type { FlatCompanyFactRow } from "@/backend/schemas/sec/companyFacts";
import type {
  BuildTagSeriesInput,
  BuiltTagSeriesRow,
} from "@/backend/services/sec/companyFacts/series/types";
import type { FlowPeriodProfile } from "@/backend/services/sec/companyFacts/series/canonicalize/flowPeriod";
import type { AnnualCycleAnchors } from "@/backend/services/sec/companyFacts/series/canonicalize/annualCycleTypes";

import {
  classifyRawFlowPeriodType,
  deriveFrame,
  type RawFlowPeriodType,
} from "@/backend/services/sec/companyFacts/series/canonicalize/flowPeriod";
import { isWithinAnnualWindow } from "@/backend/services/sec/companyFacts/series/canonicalize/dateWindows";
import {
  buildBaseRow,
  buildSeriesKey,
  sortSeriesRows,
  upsertLatestByKey,
} from "@/backend/services/sec/companyFacts/series/canonicalize/selectSeriesRow";

export function collectAnnualCycleAnchors(
  rowsInWindow: Array<FlatCompanyFactRow & { end: string; val: number }>,
  annualRow: BuiltTagSeriesRow,
  input: BuildTagSeriesInput,
  profile?: FlowPeriodProfile | null,
): AnnualCycleAnchors {
  const directQuarterlies = dedupeQuarterliesByFrame(
    rowsInWindow
      .filter((point) => {
        const rawType = classifyRawFlowPeriodType(point.start, point.end, profile);

        if (rawType === "3m") {
          return true;
        }

        return isOutlierQuarterCandidate(point, annualRow, profile);
      })
      .map((point) => ({
        ...buildBaseRow(point, input),
        display_frame: deriveFrame("quarterly", point.start, point.end),
        period_type: "quarterly" as const,
      })),
  );

  const cumulative6m = pickLatestRowByDurationNearAnnualStart(
    rowsInWindow,
    "6m",
    annualRow,
    input,
    profile,
  );

  const cumulative9m = pickLatestRowByDurationNearAnnualStart(
    rowsInWindow,
    "9m",
    annualRow,
    input,
    profile,
  );

  const trailing6m = pickLatestRowByDurationByEnd(
    rowsInWindow,
    "6m",
    annualRow.end,
    input,
    profile,
  );

  return {
    directQuarterlies,
    cumulative6m,
    cumulative9m,
    trailing6m,
  };
}

export function pickLatestRowByDurationNearAnnualStart(
  points: Array<FlatCompanyFactRow & { end: string; val: number }>,
  duration: RawFlowPeriodType,
  annualRow: BuiltTagSeriesRow,
  input: BuildTagSeriesInput,
  profile?: FlowPeriodProfile | null,
): BuiltTagSeriesRow | null {
  if (!annualRow.start) {
    return null;
  }

  const annualStartMs = new Date(annualRow.start).getTime();
  const annualEndMs = new Date(annualRow.end).getTime();

  const candidates = points
    .filter((point) => {
      if (!point.start) {
        return false;
      }

      const pointStartMs = new Date(point.start).getTime();
      const pointEndMs = new Date(point.end).getTime();

      if (Number.isNaN(pointStartMs) || Number.isNaN(pointEndMs)) {
        return false;
      }

      if (pointStartMs < annualStartMs || pointEndMs > annualEndMs) {
        return false;
      }

      return classifyRawFlowPeriodType(point.start, point.end, profile) === duration;
    })
    .map((point) => ({
      ...buildBaseRow(point, input),
      display_frame: null,
      period_type: "other" as const,
    }));

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    const aStartDiff = a.start
      ? Math.abs(new Date(a.start).getTime() - annualStartMs)
      : Number.MAX_SAFE_INTEGER;
    const bStartDiff = b.start
      ? Math.abs(new Date(b.start).getTime() - annualStartMs)
      : Number.MAX_SAFE_INTEGER;

    if (aStartDiff !== bStartDiff) {
      return aStartDiff - bStartDiff;
    }

    const aFiled = a.filed ? new Date(a.filed).getTime() : 0;
    const bFiled = b.filed ? new Date(b.filed).getTime() : 0;

    return bFiled - aFiled;
  });

  return candidates[0] ?? null;
}

export function pickLatestRowByDurationByEnd(
  points: Array<FlatCompanyFactRow & { end: string; val: number }>,
  duration: RawFlowPeriodType,
  annualEnd: string,
  input: BuildTagSeriesInput,
  profile?: FlowPeriodProfile | null,
): BuiltTagSeriesRow | null {
  const candidates = points
    .filter((point) => point.end === annualEnd)
    .filter(
      (point) => classifyRawFlowPeriodType(point.start, point.end, profile) === duration,
    )
    .map((point) => ({
      ...buildBaseRow(point, input),
      display_frame: null,
      period_type: "other" as const,
    }));

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort((a, b) => {
    const aFiled = a.filed ? new Date(a.filed).getTime() : 0;
    const bFiled = b.filed ? new Date(b.filed).getTime() : 0;
    return bFiled - aFiled;
  })[0];
}

export function isRawPointWithinAnnualWindow(
  point: FlatCompanyFactRow & { end: string; val: number },
  annualRow: BuiltTagSeriesRow,
): boolean {
  const pointStart = point.start ? new Date(point.start).getTime() : NaN;
  const pointEnd = new Date(point.end).getTime();
  const annualStart = annualRow.start ? new Date(annualRow.start).getTime() : NaN;
  const annualEnd = new Date(annualRow.end).getTime();

  if (
    Number.isNaN(pointStart) ||
    Number.isNaN(pointEnd) ||
    Number.isNaN(annualStart) ||
    Number.isNaN(annualEnd)
  ) {
    return false;
  }

  return isWithinAnnualWindow({
    start: pointStart,
    end: pointEnd,
    annualStart,
    annualEnd,
  });
}

export function dedupeQuarterliesByFrame(rows: BuiltTagSeriesRow[]): BuiltTagSeriesRow[] {
  const deduped = new Map<string, BuiltTagSeriesRow>();

  for (const row of rows) {
    upsertLatestByKey(deduped, buildSeriesKey(row), row);
  }

  return sortSeriesRows(Array.from(deduped.values()));
}

export function isOutlierQuarterCandidate(
  point: FlatCompanyFactRow & { end: string; val: number },
  annualRow: BuiltTagSeriesRow,
  profile?: FlowPeriodProfile | null,
): boolean {
  if (!profile?.outlierClusters || profile.outlierClusters.length === 0) {
    return false;
  }

  if (!point.start) {
    return false;
  }

  const startMs = new Date(point.start).getTime();
  const endMs = new Date(point.end).getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return false;
  }

  const dayMs = 1000 * 60 * 60 * 24;
  const durationDays = Math.floor((endMs - startMs) / dayMs) + 1;

  const matchesOutlierCluster = profile.outlierClusters.some(
    (cluster) =>
      durationDays >= cluster.min &&
      durationDays <= cluster.max,
  );

  if (!matchesOutlierCluster) {
    return false;
  }

  if (!isRawPointWithinAnnualWindow(point, annualRow)) {
    return false;
  }

  return isSameDate(point.start, annualRow.start) || isSameDate(point.end, annualRow.end);
}

function toDateKey(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function isSameDate(
  a: string | Date | null | undefined,
  b: string | Date | null | undefined,
): boolean {
  const aKey = toDateKey(a);
  const bKey = toDateKey(b);

  return aKey !== null && bKey !== null && aKey === bKey;
}

