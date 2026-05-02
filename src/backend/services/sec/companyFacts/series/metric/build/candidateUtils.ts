import type { MetricBuildCandidate, MetricBuildSourceRow } from "./types";
import type { MetricBuildSourceKind } from "@/backend/services/sec/companyFacts/series/metric/types";
import type { ResolvedPeriod } from "@/backend/services/sec/companyFacts/series/period/types";
import { toUtcDateMs } from "@/backend/services/sec/companyFacts/series/utils/dateKey";

const DAY_MS = 24 * 60 * 60 * 1000;

export function toMetricBuildCandidate(input: {
  row: MetricBuildSourceRow;
  resolvedPeriod: ResolvedPeriod;
  buildSourceKind?: MetricBuildSourceKind;
}): MetricBuildCandidate {
  return {
    ...input.row,
    resolvedPeriod: input.resolvedPeriod,
    buildSourceKind:
      input.buildSourceKind ?? inferRawSourceKind(input.row, input.resolvedPeriod),
  };
}

export function inferRawSourceKind(
  _row: Pick<MetricBuildSourceRow, "start" | "end" | "duration_days">,
  resolvedPeriod: ResolvedPeriod,
): MetricBuildSourceKind {
  if (
    resolvedPeriod.kind === "quarter" ||
    resolvedPeriod.kind === "annual" ||
    resolvedPeriod.kind === "ytd"
  ) {
    return resolvedPeriod.windowMatchKind === "exact" ||
      resolvedPeriod.windowMatchKind === "near"
      ? "raw_direct"
      : "raw_partial";
  }

  return "raw_direct";
}

export function getActualDurationDays(
  row: Pick<MetricBuildSourceRow, "start" | "end" | "duration_days">,
): number | null {
  if (row.duration_days != null) {
    return Number(row.duration_days);
  }

  return diffDaysInclusive(row.start, row.end);
}

export function diffDaysInclusive(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
): number | null {
  const startMs = toUtcDateMs(start);
  const endMs = toUtcDateMs(end);

  if (startMs == null || endMs == null || endMs < startMs) return null;
  return Math.round((endMs - startMs) / DAY_MS) + 1;
}

export function absDiffDays(
  a: string | Date | null | undefined,
  b: string | Date | null | undefined,
): number | null {
  const aMs = toUtcDateMs(a);
  const bMs = toUtcDateMs(b);

  if (aMs == null || bMs == null) return null;
  return Math.round(Math.abs(aMs - bMs) / DAY_MS);
}
