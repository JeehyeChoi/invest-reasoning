import { fpToQuarter } from "@/backend/services/sec/companyFacts/series/period/classifyFp";
import { normalizeFiscalYear } from "@/backend/services/sec/companyFacts/series/period/normalizeFiscalYear";
import type {
  FiscalQuarter,
  ResolvedPeriod,
} from "@/backend/services/sec/companyFacts/series/period/types";
import type { InstantSourceRow } from "@/backend/services/sec/companyFacts/series/instant/types";
import { requireDateKey } from "@/backend/services/sec/companyFacts/series/utils/dateKey";
import type { PeriodResolveContext } from "@/backend/services/sec/companyFacts/series/period/resolveContext";
import {
  buildFiscalQuarterWindows,
  type FiscalQuarterWindow,
} from "@/backend/services/sec/companyFacts/series/period/buildPeriodWindows";
import { absDiffPeriodDays } from "@/backend/services/sec/companyFacts/series/period/dateUtils";

const SNAPSHOT_END_TOLERANCE_DAYS = 14;

type InstantPeriodInputRow = Pick<InstantSourceRow, "end" | "fy" | "fp">;

type InstantWindowMatch = {
  window: FiscalQuarterWindow;
  score: number;
  confidence: number;
  matchKind: ResolvedPeriod["windowMatchKind"];
};

export function resolveInstantPeriod(input: {
  row: InstantPeriodInputRow;
  periodContext?: PeriodResolveContext;
}): ResolvedPeriod {
  const { row } = input;
  const fiscalYear = normalizeFiscalYear(row.fy);
  const fiscalQuarter = fpToQuarter(row.fp);
  const expectedEnd = requireDateKey(row.end);
  const fiscalProfile = input.periodContext?.fiscalProfile ?? null;

  if (!fiscalProfile) {
    return resolveFromSecLabels({
      fiscalYear,
      fiscalQuarter,
      expectedEnd,
      issues: ["missing_fiscal_profile"],
    });
  }

  const windows =
    input.periodContext?.fiscalQuarterWindows ??
    buildFiscalQuarterWindows(fiscalProfile);
  const candidateWindows =
    fiscalYear != null
      ? windows.filter((window) => Math.abs(window.fiscalYear - fiscalYear) <= 1)
      : windows;
  const best = pickBestInstantWindow({
    rowEnd: row.end,
    fiscalYear,
    fiscalQuarter,
    windows: candidateWindows,
  });

  if (!best || best.score <= 0) {
    return resolveFromSecLabels({
      fiscalYear,
      fiscalQuarter,
      expectedEnd,
      issues: ["outside_expected_window"],
    });
  }

  return {
    kind: "instant",
    fiscalYear: best.window.fiscalYear,
    fiscalQuarter: best.window.fiscalQuarter,
    calendarYear: null,
    calendarQuarter: null,
    expectedStart: best.window.start,
    expectedEnd: best.window.end,
    confidence: best.confidence,
    fitScore: best.score,
    windowMatchKind: best.matchKind,
    secLabelAlignment: resolveSecLabelAlignment({
      fiscalYear,
      fiscalQuarter,
      window: best.window,
    }),
    basis: "fiscal_profile",
    issues: [],
  };
}

function resolveFromSecLabels(input: {
  fiscalYear: number | null;
  fiscalQuarter: FiscalQuarter | null;
  expectedEnd: string;
  issues: ResolvedPeriod["issues"];
}): ResolvedPeriod {
  return {
    kind: "instant",
    fiscalYear: input.fiscalYear,
    fiscalQuarter: input.fiscalQuarter,
    calendarYear: null,
    calendarQuarter: null,
    expectedStart: null,
    expectedEnd: input.expectedEnd,
    confidence: input.fiscalYear != null && input.fiscalQuarter != null ? 0.65 : 0.45,
    fitScore: input.fiscalYear != null && input.fiscalQuarter != null ? 0.65 : 0.45,
    windowMatchKind: "unknown",
    secLabelAlignment: "unknown",
    basis: "instant_snapshot",
    issues: input.issues,
  };
}

function pickBestInstantWindow(input: {
  rowEnd: InstantPeriodInputRow["end"];
  fiscalYear: number | null;
  fiscalQuarter: FiscalQuarter | null;
  windows: FiscalQuarterWindow[];
}): InstantWindowMatch | null {
  let best: InstantWindowMatch | null = null;

  for (const window of input.windows) {
    const endDiff = absDiffPeriodDays(input.rowEnd, window.end);
    const score = scoreSnapshotEndDistance(endDiff);
    const fyBonus =
      input.fiscalYear != null && input.fiscalYear === window.fiscalYear ? 0.08 : 0;
    const fqBonus =
      input.fiscalQuarter != null && input.fiscalQuarter === window.fiscalQuarter ? 0.08 : 0;
    const mismatchPenalty =
      (input.fiscalYear != null && input.fiscalYear !== window.fiscalYear) ||
      (input.fiscalQuarter != null && input.fiscalQuarter !== window.fiscalQuarter)
        ? 0.12
        : 0;
    const confidence = Math.max(0, Math.min(1, score + fyBonus + fqBonus - mismatchPenalty));
    const matchKind = classifySnapshotMatch(endDiff);
    const candidate = {
      window,
      score,
      confidence,
      matchKind,
    };

    if (
      !best ||
      candidate.confidence > best.confidence ||
      (candidate.confidence === best.confidence && candidate.score > best.score)
    ) {
      best = candidate;
    }
  }

  return best;
}

function scoreSnapshotEndDistance(diffDays: number | null): number {
  if (diffDays === null) return 0;
  if (diffDays === 0) return 1;
  if (diffDays <= SNAPSHOT_END_TOLERANCE_DAYS) {
    return 1 - diffDays / (SNAPSHOT_END_TOLERANCE_DAYS * 2);
  }

  return 0;
}

function classifySnapshotMatch(
  diffDays: number | null,
): ResolvedPeriod["windowMatchKind"] {
  if (diffDays === null) return "unknown";
  if (diffDays === 0) return "exact";
  if (diffDays <= SNAPSHOT_END_TOLERANCE_DAYS) return "near";
  return "outside";
}

function resolveSecLabelAlignment(input: {
  fiscalYear: number | null;
  fiscalQuarter: FiscalQuarter | null;
  window: FiscalQuarterWindow;
}): ResolvedPeriod["secLabelAlignment"] {
  if (input.fiscalYear == null && input.fiscalQuarter == null) return "unknown";

  return input.fiscalYear === input.window.fiscalYear &&
    input.fiscalQuarter === input.window.fiscalQuarter
    ? "aligned"
    : "misaligned";
}
