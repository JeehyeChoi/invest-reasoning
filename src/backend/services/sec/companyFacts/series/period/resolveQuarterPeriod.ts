// src/backend/services/sec/companyFacts/series/period/resolveQuarterPeriod.ts

import type { FiscalQuarter, ResolvePeriodInput, ResolvedPeriod } from "./types";
import {
  buildFiscalQuarterWindows,
  buildFiscalYearWindows,
} from "./buildPeriodWindows";
import { classifyDurationDays } from "./classifyDuration";
import { parseCalendarFrame } from "./classifyFrame";
import { classifyFormPeriodHint } from "./classifyForm";
import { classifyFpPeriodHint, fpToQuarter } from "./classifyFp";
import { normalizeFiscalYear } from "./normalizeFiscalYear";
import { toDateKey } from "@/backend/services/sec/companyFacts/series/utils/dateKey";
import {
  type PeriodWindowScore,
  pickBestScoredWindow,
  scoreFiscalQuarterWindow,
} from "./scorePeriodWindow";
import { absDiffPeriodDays, isPeriodWithinInclusiveRange } from "./dateUtils";

function getQuarterCandidateConfidence(input: {
  durationKind: string;
  formHint: string;
  fpHint: string;
  frameQuarter: FiscalQuarter | null;
}): number {
  let score = 0;

  if (input.durationKind === "quarter") score += 0.35;
  if (input.formHint === "quarter") score += 0.25;
  if (input.fpHint === "quarter") score += 0.25;
  if (input.frameQuarter !== null) score += 0.15;

  return Math.min(score, 1);
}

export function resolveQuarterPeriod(
  input: ResolvePeriodInput,
): ResolvedPeriod | null {
  const { row, fiscalProfile } = input;

  const duration = classifyDurationDays(row.duration_days);
  const form = classifyFormPeriodHint(row.form);
  const fp = classifyFpPeriodHint(row.fp);
  const fiscalYear = normalizeFiscalYear(row.fy);
  const explicitFpQuarter = fpToQuarter(row.fp);
  const calendarFrame = parseCalendarFrame(row.frame);

  const candidateConfidence = getQuarterCandidateConfidence({
    durationKind: duration.kind,
    formHint: form,
    fpHint: fp,
    frameQuarter: calendarFrame?.calendarQuarter ?? null,
  });

  if (candidateConfidence <= 0) {
    return null;
  }

  if (!fiscalProfile) {
    return {
      kind: "quarter",
      fiscalYear: fiscalYear ?? calendarFrame?.calendarYear ?? null,
      fiscalQuarter: explicitFpQuarter ?? calendarFrame?.calendarQuarter ?? null,
      calendarYear: calendarFrame?.calendarYear ?? null,
      calendarQuarter: calendarFrame?.calendarQuarter ?? null,
      expectedStart: null,
      expectedEnd: null,
      confidence: Math.min(candidateConfidence, 0.45),
      fitScore: Math.min(candidateConfidence, 0.45),
      windowMatchKind: "unknown",
      secLabelAlignment: "unknown",
      basis: explicitFpQuarter ? "sec_fp" : calendarFrame ? "sec_frame" : "duration",
      issues: ["missing_fiscal_profile"],
    };
  }

	const windows =
		input.periodContext?.fiscalQuarterWindows ??
		buildFiscalQuarterWindows(fiscalProfile);
  const fiscalYearWindows =
    input.periodContext?.fiscalYearWindows ??
    buildFiscalYearWindows(fiscalProfile);

	const candidateWindows =
		fiscalYear != null
			? windows.filter((w) => Math.abs(w.fiscalYear - fiscalYear) <= 1)
			: windows;

  const scored: Array<
    PeriodWindowScore<(typeof candidateWindows)[number]> & { cumulativeLike: boolean }
  > = candidateWindows.map((window) => {
    const base = scoreFiscalQuarterWindow({ row, window });
    const fiscalYearWindow = fiscalYearWindows.find(
      (candidate) => candidate.fiscalYear === window.fiscalYear,
    );
    const cumulativeLike =
      window.fiscalQuarter > 1 &&
      fiscalYearWindow != null &&
      isNear(row.start, fiscalYearWindow.start, 2) &&
      isNear(row.end, window.end, 2);

    const fpBonus =
      explicitFpQuarter !== null && explicitFpQuarter === window.fiscalQuarter
        ? 0.12
        : 0;

    const frameBonus =
      calendarFrame?.calendarQuarter !== null &&
      calendarFrame?.calendarQuarter === window.fiscalQuarter
        ? 0.05
        : 0;

    const fpPenalty =
      explicitFpQuarter !== null && explicitFpQuarter !== window.fiscalQuarter
        ? 0.2
        : 0;

    return {
      ...base,
      cumulativeLike,
      score: Math.max(0, Math.min(1, base.score + fpBonus + frameBonus - fpPenalty)),
    };
  });

  const best = pickBestScoredWindow(scored) as (typeof scored)[number] | null;

  const acceptableMatch =
    best != null &&
    !best.cumulativeLike &&
    (
      best.matchKind === "exact" ||
      best.matchKind === "near" ||
      (
        best.matchKind === "partial" &&
        isStrictQuarterPartial({
          row,
          expectedStart: best.window.start,
          expectedEnd: best.window.end,
        })
      )
    ) &&
    (
      best.score >= 0.45 ||
      (
        best.matchKind === "partial" &&
        isStrictQuarterPartial({
          row,
          expectedStart: best.window.start,
          expectedEnd: best.window.end,
        })
      )
    );

  if (!acceptableMatch || !best) {
    const secLabelFallback = resolveQuarterFromSecLabels({
      row,
      durationKind: duration.kind,
      explicitFpQuarter,
      calendarFrame,
      candidateConfidence,
    });

    if (secLabelFallback) {
      return secLabelFallback;
    }

    return null;
  }

  return {
    kind: "quarter",
    fiscalYear: best.window.fiscalYear,
    fiscalQuarter: best.window.fiscalQuarter,
    calendarYear: calendarFrame?.calendarYear ?? null,
    calendarQuarter: calendarFrame?.calendarQuarter ?? null,
    expectedStart: best.window.start,
    expectedEnd: best.window.end,
    confidence: Math.min(1, Math.max(best.score, candidateConfidence)),
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

function resolveQuarterFromSecLabels(input: {
  row: ResolvePeriodInput["row"];
  durationKind: string;
  explicitFpQuarter: FiscalQuarter | null;
  calendarFrame: ReturnType<typeof parseCalendarFrame>;
  candidateConfidence: number;
}): ResolvedPeriod | null {
  if (
    normalizeFiscalYear(input.row.fy) == null ||
    input.explicitFpQuarter == null ||
    input.durationKind !== "quarter"
  ) {
    return null;
  }

  return {
    kind: "quarter",
    fiscalYear: normalizeFiscalYear(input.row.fy),
    fiscalQuarter: input.explicitFpQuarter,
    calendarYear: input.calendarFrame?.calendarYear ?? null,
    calendarQuarter: input.calendarFrame?.calendarQuarter ?? null,
    expectedStart: input.row.start ? toDateKey(input.row.start) : null,
    expectedEnd: input.row.end ? toDateKey(input.row.end) : null,
    confidence: Math.min(input.candidateConfidence, 0.7),
    fitScore: Math.min(input.candidateConfidence, 0.7),
    windowMatchKind: "exact",
    secLabelAlignment: "aligned",
    basis: "sec_fp",
    issues: ["outside_expected_window"],
  };
}

function isNear(
  a: string | Date | null | undefined,
  b: string | Date | null | undefined,
  toleranceDays: number,
): boolean {
  const diff = absDiffPeriodDays(a, b);
  return diff !== null && diff <= toleranceDays;
}

function isStrictQuarterPartial(input: {
  row: ResolvePeriodInput["row"];
  expectedStart: string;
  expectedEnd: string;
}): boolean {
  const durationDays = input.row.duration_days ?? null;

  if (durationDays == null || durationDays >= 170) {
    return false;
  }

  return isPeriodWithinInclusiveRange({
    start: input.row.start,
    end: input.row.end,
    expectedStart: input.expectedStart,
    expectedEnd: input.expectedEnd,
  });
}
