// src/backend/services/sec/companyFacts/series/period/scorePeriodWindow.ts

import type { PeriodResolutionIssue, PeriodWindowMatchKind } from "./types";
import type {
  FiscalQuarterWindow,
  FiscalYearWindow,
} from "./buildPeriodWindows";
import { absDiffPeriodDays, getPeriodDurationDays } from "./dateUtils";
import { toUtcDateMs } from "@/backend/services/sec/companyFacts/series/utils/dateKey";

export type PeriodWindowScore<TWindow> = {
  window: TWindow;
  score: number;
  matchKind: PeriodWindowMatchKind;
  issues: PeriodResolutionIssue[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

function scoreDateDistance(diff: number | null, toleranceDays: number): number {
  if (diff === null) return 0;

  if (diff === 0) return 1;
  if (diff <= toleranceDays) return 1 - diff / (toleranceDays * 2);

  return 0;
}

function scoreDurationDistance(input: {
  actualDurationDays: number | null;
  expectedDurationDays: number | null;
  toleranceDays: number;
}): number {
  if (
    input.actualDurationDays === null ||
    input.expectedDurationDays === null
  ) {
    return 0;
  }

  const diff = Math.abs(input.actualDurationDays - input.expectedDurationDays);

  if (diff === 0) return 1;
  if (diff <= input.toleranceDays) {
    return 1 - diff / (input.toleranceDays * 2);
  }

  return 0;
}

function isContainedWithinExpectedWindow(input: {
  actualStart: string | Date | null | undefined;
  actualEnd: string | Date | null | undefined;
  expectedStart: string | Date;
  expectedEnd: string | Date;
}): boolean {
  const actualStartMs = toUtcDateMs(input.actualStart);
  const actualEndMs = toUtcDateMs(input.actualEnd);
  const expectedStartMs = toUtcDateMs(input.expectedStart);
  const expectedEndMs = toUtcDateMs(input.expectedEnd);

  if (
    actualStartMs === null ||
    actualEndMs === null ||
    expectedStartMs === null ||
    expectedEndMs === null
  ) {
    return false;
  }

  return actualStartMs >= expectedStartMs && actualEndMs <= expectedEndMs;
}

function classifyWindowMatch(input: {
  startDiff: number | null;
  endDiff: number | null;
  durationDiff: number | null;
  actualStart: string | Date | null | undefined;
  actualEnd: string | Date | null | undefined;
  expectedStart: string | Date;
  expectedEnd: string | Date;
  toleranceDays: number;
}): PeriodWindowMatchKind {
  const { startDiff, endDiff, durationDiff, toleranceDays } = input;

  if (startDiff === null || endDiff === null) {
    return "unknown";
  }

  if (startDiff === 0 && endDiff === 0 && (durationDiff === null || durationDiff === 0)) {
    return "exact";
  }

  if (
    startDiff <= toleranceDays &&
    endDiff <= toleranceDays &&
    (durationDiff === null || durationDiff <= toleranceDays)
  ) {
    return "near";
  }

  if (
    isContainedWithinExpectedWindow({
      actualStart: input.actualStart,
      actualEnd: input.actualEnd,
      expectedStart: input.expectedStart,
      expectedEnd: input.expectedEnd,
    })
  ) {
    return "partial";
  }

  return "outside";
}

export function scoreExpectedPeriodWindow(input: {
  row: {
    start: string | Date | null | undefined;
    end: string | Date | null | undefined;
    duration_days?: number | null;
  };
  expectedStart: string | Date;
  expectedEnd: string | Date;
  startEndToleranceDays: number;
  durationToleranceDays: number;
}): Omit<PeriodWindowScore<null>, "window"> {
  const actualDurationDays = getPeriodDurationDays({
    start: input.row.start,
    end: input.row.end,
    durationDays: input.row.duration_days,
  });

  const expectedDurationDays = getPeriodDurationDays({
    start: input.expectedStart,
    end: input.expectedEnd,
  });

  const startDiff = absDiffPeriodDays(input.row.start, input.expectedStart);
  const endDiff = absDiffPeriodDays(input.row.end, input.expectedEnd);
  const durationDiff =
    actualDurationDays === null || expectedDurationDays === null
      ? null
      : Math.abs(actualDurationDays - expectedDurationDays);

  const startScore = scoreDateDistance(startDiff, input.startEndToleranceDays);
  const endScore = scoreDateDistance(endDiff, input.startEndToleranceDays);
  const durationScore = scoreDurationDistance({
    actualDurationDays,
    expectedDurationDays,
    toleranceDays: input.durationToleranceDays,
  });

  const issues: PeriodResolutionIssue[] = [];

  if (startDiff === null) issues.push("missing_start");
  if (endDiff === null) issues.push("missing_end");
  if (actualDurationDays === null) issues.push("missing_duration");

  return {
    score: startScore * 0.35 + endScore * 0.45 + durationScore * 0.2,
    matchKind: classifyWindowMatch({
      startDiff,
      endDiff,
      durationDiff,
      actualStart: input.row.start,
      actualEnd: input.row.end,
      expectedStart: input.expectedStart,
      expectedEnd: input.expectedEnd,
      toleranceDays: input.startEndToleranceDays,
    }),
    issues,
  };
}

export function scoreFiscalYearWindow(input: {
  row: {
    start: string | Date | null | undefined;
    end: string | Date | null | undefined;
    duration_days?: number | null;
  };
  window: FiscalYearWindow;
}): PeriodWindowScore<FiscalYearWindow> {
  const base = scoreExpectedPeriodWindow({
    row: input.row,
    expectedStart: input.window.start,
    expectedEnd: input.window.end,
    startEndToleranceDays: 14,
    durationToleranceDays: 21,
  });

  return {
    window: input.window,
    score: base.score,
    matchKind: base.matchKind,
    issues: base.issues,
  };
}

export function scoreFiscalQuarterWindow(input: {
  row: {
    start: string | Date | null | undefined;
    end: string | Date | null | undefined;
    duration_days?: number | null;
  };
  window: FiscalQuarterWindow;
}): PeriodWindowScore<FiscalQuarterWindow> {
  const base = scoreExpectedPeriodWindow({
    row: input.row,
    expectedStart: input.window.start,
    expectedEnd: input.window.end,
    startEndToleranceDays: 10,
    durationToleranceDays: 14,
  });

  return {
    window: input.window,
    score: base.score,
    matchKind: base.matchKind,
    issues: base.issues,
  };
}

export function pickBestScoredWindow<TWindow>(
  scores: PeriodWindowScore<TWindow>[],
): PeriodWindowScore<TWindow> | null {
  if (scores.length === 0) return null;

  return scores.reduce((best, current) =>
    current.score > best.score ? current : best,
  );
}
