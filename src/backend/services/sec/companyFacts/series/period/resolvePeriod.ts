// src/backend/services/sec/companyFacts/series/period/resolvePeriod.ts

import { classifyDurationDays } from "@/backend/services/sec/companyFacts/series/period/classifyDuration";
import { classifyFormPeriodHint } from "@/backend/services/sec/companyFacts/series/period/classifyForm";
import { classifyFpPeriodHint } from "@/backend/services/sec/companyFacts/series/period/classifyFp";
import type { ResolvePeriodInput, ResolvedPeriod } from "@/backend/services/sec/companyFacts/series/period/types";
import { resolveAnnualPeriod } from "@/backend/services/sec/companyFacts/series/period/resolveAnnualPeriod";
import { resolveQuarterPeriod } from "@/backend/services/sec/companyFacts/series/period/resolveQuarterPeriod";
import { resolveYtdPeriod } from "@/backend/services/sec/companyFacts/series/period/resolveYtdPeriod";

export function resolvePeriod(input: ResolvePeriodInput): ResolvedPeriod {
  const duration = classifyDurationDays(input.row.duration_days);
  const form = classifyFormPeriodHint(input.row.form);
  const fp = classifyFpPeriodHint(input.row.fp);

  if (
    duration.kind === "annual" ||
    form === "annual" ||
    fp === "annual"
  ) {
    const annual = resolveAnnualPeriod(input);
    if (annual) return annual;
  }

  if (
    duration.kind === "quarter" ||
    form === "quarter" ||
    fp === "quarter"
  ) {
    const quarter = resolveQuarterPeriod(input);
    if (quarter) return quarter;
  }

  if (duration.kind === "ytd") {
    const ytd = resolveYtdPeriod(input);
    if (ytd) return ytd;
  }

  if (duration.kind === "instant") {
    return {
      kind: "instant",
      fiscalYear: input.row.fy ?? null,
      fiscalQuarter: null,
      calendarYear: null,
      calendarQuarter: null,
      expectedStart: null,
      expectedEnd: input.row.end ? String(input.row.end).slice(0, 10) : null,
      confidence: 0.8,
      fitScore: 0.8,
      windowMatchKind: "exact",
      secLabelAlignment: "unknown",
      basis: "duration",
      issues: [],
    };
  }

  return {
    kind: "other",
    fiscalYear: input.row.fy ?? null,
    fiscalQuarter: null,
    calendarYear: null,
    calendarQuarter: null,
    expectedStart: null,
    expectedEnd: null,
    confidence: 0.2,
    fitScore: 0.2,
    windowMatchKind: "unknown",
    secLabelAlignment: "unknown",
    basis: "unresolved",
    issues: ["unresolved"],
  };
}
