// src/backend/services/sec/companyFacts/series/period/resolveAnnualPeriod.ts

import type { ResolvePeriodInput, ResolvedPeriod } from "./types";
import { classifyDurationDays } from "./classifyDuration";
import { classifyFormPeriodHint } from "./classifyForm";
import { classifyFpPeriodHint, normalizeFpValue } from "./classifyFp";
import { buildFiscalYearWindows } from "./buildPeriodWindows";
import {
  scoreFiscalYearWindow,
  pickBestScoredWindow,
} from "./scorePeriodWindow";

export function resolveAnnualPeriod(
  input: ResolvePeriodInput,
): ResolvedPeriod | null {
  const { row, fiscalProfile } = input;

  const duration = classifyDurationDays(row.duration_days);
  const form = classifyFormPeriodHint(row.form);
  const fp = classifyFpPeriodHint(row.fp);

  const isAnnualCandidate =
    duration.kind === "annual" ||
    form === "annual" ||
    fp === "annual";

  if (!isAnnualCandidate) {
    return null;
  }

  if (!fiscalProfile) {
    return {
      kind: "annual",
      fiscalYear: row.fy ?? null,
      fiscalQuarter: null,
      calendarYear: null,
      calendarQuarter: null,
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

	const windows =
		input.periodContext?.fiscalYearWindows ??
		buildFiscalYearWindows(fiscalProfile);

	const frameYear = parseAnnualCalendarFrameYear(row.frame);
	const candidateWindows =
		row.fy != null || frameYear != null
			? windows.filter((w) =>
				(row.fy != null && Math.abs(w.fiscalYear - row.fy) <= 1) ||
				(frameYear != null && Math.abs(w.fiscalYear - frameYear) <= 1),
			)
			: windows;

	const scores = candidateWindows.map((w) =>
		scoreFiscalYearWindow({
			row,
			window: w,
		}),
	);

  const best = pickBestScoredWindow(scores);

  if (
    !best ||
    !(
      best.matchKind === "exact" ||
      best.matchKind === "near"
    ) ||
    best.score < 0.5
  ) {
    return null;
  }

  const normalizedFp = normalizeFpValue(row.fp);

  return {
    kind: "annual",
    fiscalYear: best.window.fiscalYear,
    fiscalQuarter: null,
    calendarYear: null,
    calendarQuarter: null,
    expectedStart: best.window.start,
    expectedEnd: best.window.end,
    confidence: best.score,
    fitScore: best.score,
    windowMatchKind: best.matchKind,
    secLabelAlignment:
      row.fy != null && normalizedFp === "FY" && row.fy === best.window.fiscalYear
        ? "aligned"
        : row.fy != null || normalizedFp != null
          ? "misaligned"
          : "unknown",
    basis: "annual_window",
    issues: best.issues,
  };
}

function parseAnnualCalendarFrameYear(frame: string | null | undefined): number | null {
  const match = String(frame ?? "").match(/^CY(\d{4})$/);
  if (!match) return null;

  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}
