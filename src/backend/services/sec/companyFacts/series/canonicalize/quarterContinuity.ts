import type { BuiltTagSeriesRow } from "@/backend/services/sec/companyFacts/series/types";
import type { FlowPeriodProfile } from "@/backend/services/sec/companyFacts/series/canonicalize/flowPeriod";

import { shiftDateString } from "@/backend/services/sec/companyFacts/series/canonicalize/dateWindows";
import { sortSeriesRows } from "@/backend/services/sec/companyFacts/series/canonicalize/selectSeriesRow";

export function normalizeQuarterliesByContinuity(
  rows: BuiltTagSeriesRow[],
  profile?: FlowPeriodProfile | null,
): BuiltTagSeriesRow[] {
  const nonQuarterly = rows.filter(
    (row) => row.period_type !== "quarterly" || !row.display_frame,
  );

  const byFrame = new Map<string, BuiltTagSeriesRow[]>();

  for (const row of rows) {
    if (row.period_type !== "quarterly" || !row.display_frame) {
      continue;
    }

    const current = byFrame.get(row.display_frame) ?? [];
    current.push(row);
    byFrame.set(row.display_frame, current);
  }

  const selectedQuarterlies: BuiltTagSeriesRow[] = [];
  const frames = Array.from(byFrame.keys()).sort();

  for (const frame of frames) {
    const candidates = byFrame.get(frame) ?? [];

    if (candidates.length === 1) {
      selectedQuarterlies.push(candidates[0]);
      continue;
    }

    const previous = selectedQuarterlies[selectedQuarterlies.length - 1];

    if (previous) {
      const expectedStart = shiftDateString(toDateKey(previous.end), 1);

      const continuousCandidates = candidates.filter(
        (candidate) => toDateKey(candidate.start) === expectedStart,
      );

      if (continuousCandidates.length > 0) {
        selectedQuarterlies.push(
          chooseBestQuarterCandidate(continuousCandidates, profile),
        );
        continue;
      }
    }

    selectedQuarterlies.push(chooseBestQuarterCandidate(candidates, profile));
  }

  return sortSeriesRows([...nonQuarterly, ...selectedQuarterlies]);
}

function chooseBestQuarterCandidate(
  candidates: BuiltTagSeriesRow[],
  profile?: FlowPeriodProfile | null,
): BuiltTagSeriesRow {
  return [...candidates].sort((a, b) => {
    const aQuarterScore = getQuarterLikeScore(a, profile);
    const bQuarterScore = getQuarterLikeScore(b, profile);

    if (aQuarterScore !== bQuarterScore) {
      return aQuarterScore - bQuarterScore;
    }

    const aFiled = a.filed ? new Date(a.filed).getTime() : 0;
    const bFiled = b.filed ? new Date(b.filed).getTime() : 0;

    if (aFiled !== bFiled) {
      return bFiled - aFiled;
    }

    return dateKeyToTime(b.start) - dateKeyToTime(a.start);
  })[0];
}

function getQuarterLikeScore(
  row: BuiltTagSeriesRow,
  profile?: FlowPeriodProfile | null,
): number {
  const duration = getDurationDays(row);

  if (duration === null) {
    return Number.MAX_SAFE_INTEGER;
  }

  if (
    profile?.threeMonth &&
    duration >= profile.threeMonth.min &&
    duration <= profile.threeMonth.max
  ) {
    return 0;
  }

  const outlierQuarter = profile?.outlierClusters?.find(
    (cluster) => duration >= cluster.min && duration <= cluster.max,
  );

  if (outlierQuarter) {
    return 1;
  }

  if (profile?.threeMonth) {
    const center = (profile.threeMonth.min + profile.threeMonth.max) / 2;
    return 10 + Math.abs(duration - center);
  }

  return 10 + Math.abs(duration - 91);
}

function getDurationDays(row: BuiltTagSeriesRow): number | null {
  const startMs = dateKeyToTime(row.start);
  const endMs = dateKeyToTime(row.end);

  if (startMs === 0 || endMs === 0 || endMs < startMs) {
    return null;
  }

  const dayMs = 1000 * 60 * 60 * 24;
  return Math.floor((endMs - startMs) / dayMs) + 1;
}

function toDateKey(value: string | Date | null | undefined): string {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}

function dateKeyToTime(value: string | Date | null | undefined): number {
  const key = toDateKey(value);

  if (!key) {
    return 0;
  }

  return new Date(`${key}T00:00:00.000Z`).getTime();
}
