// src/backend/services/sec/companyFacts/series/period/resolveYtdPeriod.ts

import type { ResolvePeriodInput, ResolvedPeriod } from "./types";
import { classifyDurationDays } from "./classifyDuration";
import {
  buildFiscalQuarterWindows,
  buildFiscalYearWindows,
} from "./buildPeriodWindows";
import { fpToQuarter } from "./classifyFp";
import {
  pickBestScoredWindow,
  scoreExpectedPeriodWindow,
} from "./scorePeriodWindow";
import { parseCalendarFrame } from "./classifyFrame";
import { normalizeFiscalYear } from "./normalizeFiscalYear";

export function resolveYtdPeriod(
  input: ResolvePeriodInput,
): ResolvedPeriod | null {
  const { row, fiscalProfile } = input;

  const duration = classifyDurationDays(row.duration_days);
  const calendarFrame = parseCalendarFrame(row.frame);
  const fiscalYear = normalizeFiscalYear(row.fy);

  // YTD 후보가 아니면 종료
  if (duration.kind !== "ytd") {
    return null;
  }

  if (!fiscalProfile) {
    return {
      kind: "ytd",
      fiscalYear: fiscalYear ?? calendarFrame?.calendarYear ?? null,
      fiscalQuarter: null,
      calendarYear: calendarFrame?.calendarYear ?? null,
      calendarQuarter: calendarFrame?.calendarQuarter ?? null,
      expectedStart: null,
      expectedEnd: null,
      confidence: 0.4,
      fitScore: 0.4,
      windowMatchKind: "unknown",
      secLabelAlignment: "unknown",
      basis: "duration",
      issues: ["missing_fiscal_profile"],
    };
  }

	const quarterWindows =
		input.periodContext?.fiscalQuarterWindows ??
		buildFiscalQuarterWindows(fiscalProfile);

	const candidateWindows =
		fiscalYear != null
			? quarterWindows.filter((w) => Math.abs(w.fiscalYear - fiscalYear) <= 1)
			: quarterWindows;

  const fiscalYearWindows =
    input.periodContext?.fiscalYearWindows ??
    buildFiscalYearWindows(fiscalProfile);

  const scored = candidateWindows
    .map((window) => {
      const yearWindow = fiscalYearWindows.find(
        (candidate) => candidate.fiscalYear === window.fiscalYear,
      );

      if (!yearWindow) return null;

      const base = scoreExpectedPeriodWindow({
        row,
        expectedStart: yearWindow.start,
        expectedEnd: window.end,
        startEndToleranceDays: 10,
        durationToleranceDays: 21,
      });

      return {
        window,
        score: base.score,
        matchKind: base.matchKind,
        issues: base.issues,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value != null);

  const best = pickBestScoredWindow(scored);

  if (
    !best ||
    !(
      best.matchKind === "exact" ||
      best.matchKind === "near"
    ) ||
    best.score < 0.4
  ) {
    return null;
  }

  const bestYearWindow = fiscalYearWindows.find(
    (candidate) => candidate.fiscalYear === best.window.fiscalYear,
  );
  const explicitFpQuarter = fpToQuarter(row.fp);

  return {
    kind: "ytd",
    fiscalYear: best.window.fiscalYear,
    fiscalQuarter: best.window.fiscalQuarter,
    calendarYear: calendarFrame?.calendarYear ?? null,
    calendarQuarter: calendarFrame?.calendarQuarter ?? null,
    expectedStart: bestYearWindow?.start ?? null,
    expectedEnd: best.window.end,
    confidence: best.score,
    fitScore: best.score,
    windowMatchKind: best.matchKind,
    secLabelAlignment:
      fiscalYear != null && explicitFpQuarter !== null
        ? fiscalYear === best.window.fiscalYear && explicitFpQuarter === best.window.fiscalQuarter
          ? "aligned"
          : "misaligned"
        : fiscalYear != null || explicitFpQuarter != null
          ? "misaligned"
          : "unknown",
    basis: "quarter_window",
    issues: best.issues,
  };
}
