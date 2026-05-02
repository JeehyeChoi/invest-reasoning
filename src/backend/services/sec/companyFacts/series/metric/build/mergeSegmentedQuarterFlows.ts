import type { FiscalQuarterWindow } from "@/backend/services/sec/companyFacts/series/period/buildPeriodWindows";
import type { MetricBuildCandidate } from "./types";
import type { PeriodResolveContext } from "@/backend/services/sec/companyFacts/series/period/resolveContext";
import { diffDaysInclusive } from "./candidateUtils";
import { resolvePeriod } from "@/backend/services/sec/companyFacts/series/period/resolvePeriod";
import { toUtcDateMs } from "@/backend/services/sec/companyFacts/series/utils/dateKey";

export type MergedSegmentQuarterFlow = MetricBuildCandidate & {
  workflow_type: "sec_companyfacts_segment_merged_v1";
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_TOLERANCE_DAYS = 7;

export function mergeSegmentedQuarterFlows(input: {
  candidates: MetricBuildCandidate[];
  periodContext?: PeriodResolveContext;
}): MergedSegmentQuarterFlow[] {
  const quarterWindows = input.periodContext?.fiscalQuarterWindows ?? [];
  if (quarterWindows.length === 0) return [];
  const windowByQuarterKey = new Map(
    quarterWindows.map((window) => [
      `${window.fiscalYear}-${window.fiscalQuarter}`,
      window,
    ]),
  );

  const partialRows = input.candidates.filter(
    (row) =>
      row.resolvedPeriod.kind === "quarter" &&
      row.buildSourceKind === "raw_partial" &&
      row.fy != null,
  );

  const groups = groupByQuarterIdentity(partialRows);
  const results: MergedSegmentQuarterFlow[] = [];

  for (const group of groups) {
    const fy = group[0]?.resolvedPeriod.fiscalYear;
    const fq = group[0]?.resolvedPeriod.fiscalQuarter;

    if (fy == null || fq == null) continue;

    const window = windowByQuarterKey.get(`${fy}-${fq}`);

    if (!window) continue;

    const merged = tryMergeGroupToQuarterWindow(group, window, input.periodContext);
    if (merged) {
      results.push(merged);
    }
  }

  return results;
}

function groupByQuarterIdentity(rows: MetricBuildCandidate[]): MetricBuildCandidate[][] {
  const map = new Map<string, MetricBuildCandidate[]>();

  for (const row of rows) {
    const key = [
      row.metric_key,
      row.unit,
      row.tag,
      row.priority ?? 999,
      row.accn ?? "NULL",
      row.filed ? String(row.filed).slice(0, 10) : "NULL",
      row.resolvedPeriod.fiscalYear ?? "NULL",
      row.resolvedPeriod.fiscalQuarter ?? "NULL",
    ].join("|");

    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }

  return Array.from(map.values());
}

function tryMergeGroupToQuarterWindow(
  rows: MetricBuildCandidate[],
  window: FiscalQuarterWindow,
  periodContext?: PeriodResolveContext,
): MergedSegmentQuarterFlow | null {
  const sorted = [...rows]
    .filter((row) => row.start && row.end)
    .sort((a, b) => (toUtcDateMs(a.start) ?? 0) - (toUtcDateMs(b.start) ?? 0));

  if (sorted.length < 2) return null;

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (!first.start || !last.end) return null;
  if (!isNear(first.start, window.start) || !isNear(last.end, window.end)) return null;

  for (let i = 1; i < sorted.length; i++) {
    if (!isContiguous(sorted[i - 1], sorted[i])) {
      return null;
    }
  }

  const durationDays = diffDaysInclusive(first.start, last.end);
  if (durationDays == null) return null;

  const sum = sorted.reduce((acc, row) => acc + Number(row.val), 0);
  if (!Number.isFinite(sum)) return null;

  const resolvedPeriod = resolvePeriod({
    row: {
      ...last,
      start: first.start,
      end: last.end,
      duration_days: durationDays,
    },
    fiscalProfile: periodContext?.fiscalProfile ?? null,
    periodContext,
  });

  if (
    resolvedPeriod.kind !== "quarter" ||
    (resolvedPeriod.windowMatchKind !== "exact" &&
      resolvedPeriod.windowMatchKind !== "near")
  ) {
    return null;
  }

  return {
    ...last,
    val: sum,
    start: first.start,
    end: last.end,
    duration_days: durationDays,
    resolvedPeriod,
    buildSourceKind: "segment_merged",
    workflow_type: "sec_companyfacts_segment_merged_v1",
  };
}

function isNear(
  a: string | Date,
  b: string | Date,
  toleranceDays = WINDOW_TOLERANCE_DAYS,
): boolean {
  const aMs = toUtcDateMs(a);
  const bMs = toUtcDateMs(b);

  if (aMs == null || bMs == null) return false;
  return Math.round(Math.abs(aMs - bMs) / DAY_MS) <= toleranceDays;
}

function isContiguous(a: MetricBuildCandidate, b: MetricBuildCandidate): boolean {
  if (!a.end || !b.start) return false;

  const aEnd = toUtcDateMs(a.end);
  const bStart = toUtcDateMs(b.start);

  if (aEnd == null || bStart == null) return false;

  return Math.abs(bStart - (aEnd + DAY_MS)) <= DAY_MS;
}
