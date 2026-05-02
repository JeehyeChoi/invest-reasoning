// src/backend/services/sec/companyFacts/series/metric/build/reconstructQuarterFlows.ts

import type {
  CompanyFiscalProfile,
  CompanyMetricSignProfile,
} from "@/backend/services/sec/companyFacts/series/fiscal/types";
import type { MetricBuildCandidate } from "@/backend/services/sec/companyFacts/series/metric/build/types";
import type { ResolvedPeriod } from "@/backend/services/sec/companyFacts/series/period/types";
import type { PeriodResolveContext } from "@/backend/services/sec/companyFacts/series/period/resolveContext";

import { resolvePeriod } from "@/backend/services/sec/companyFacts/series/period/resolvePeriod";
import {
  toDateKey,
  toUtcDateMs,
} from "@/backend/services/sec/companyFacts/series/utils/dateKey";

export type ReconstructedQuarterFlow = MetricBuildCandidate & {
  workflow_type: "sec_companyfacts_reconstructed_v2";
};

export function reconstructQuarterFlows(input: {
  candidates: MetricBuildCandidate[];
  fiscalProfile: CompanyFiscalProfile | null;
  metricSignProfiles?: CompanyMetricSignProfile[];
  periodContext?: PeriodResolveContext;
  annualRows?: MetricBuildCandidate[];
}): ReconstructedQuarterFlow[] {
  const { candidates, fiscalProfile } = input;

  const ytdRows: MetricBuildCandidate[] = [];
  const quarterRows: MetricBuildCandidate[] = [];
  const annualRows: MetricBuildCandidate[] = [];

  for (const candidate of candidates) {
    switch (candidate.resolvedPeriod.kind) {
      case "ytd":
        ytdRows.push(candidate);
        break;
      case "quarter":
        quarterRows.push(candidate);
        break;
      case "annual":
        annualRows.push(candidate);
        break;
      default:
        break;
    }
  }

  const previousIndex = buildPreviousCumulativeIndex([...quarterRows, ...ytdRows]);
  const trailingQuarterIndex = buildTrailingQuarterIndex(quarterRows);
  const rawDirectQuarterIndex = buildRawDirectQuarterIndex(quarterRows);
  const signProfileIndex = buildSignProfileIndex(input.metricSignProfiles ?? []);

  return [
    ...reconstructByDifference({
      current: ytdRows,
      previousIndex,
      rawDirectQuarterIndex,
      signProfileIndex,
      fiscalProfile,
		  periodContext: input.periodContext,
    }),
    ...reconstructByDifference({
      current: input.annualRows ?? annualRows,
      previousIndex: buildPreviousCumulativeIndex(ytdRows),
      rawDirectQuarterIndex,
      signProfileIndex,
      fiscalProfile,
		  periodContext: input.periodContext,
    }),
    ...reconstructLeadingQuarterFromCumulative({
      cumulative: ytdRows,
      trailingQuarterIndex,
      signProfileIndex,
      fiscalProfile,
		  periodContext: input.periodContext,
    }),
  ];
}

function reconstructByDifference(input: {
  current: MetricBuildCandidate[];
  previousIndex: Map<string, MetricBuildCandidate[]>;
  rawDirectQuarterIndex: Map<string, MetricBuildCandidate[]>;
  signProfileIndex: Map<string, CompanyMetricSignProfile>;
  fiscalProfile: CompanyFiscalProfile | null;
  periodContext?: PeriodResolveContext;
}): ReconstructedQuarterFlow[] {
  const results: ReconstructedQuarterFlow[] = [];

  for (const current of input.current) {
    const previous = findPreviousCumulative({
      current,
      previousIndex: input.previousIndex,
    });

    if (!previous) continue;
    if (!current.start || !current.end || !previous.end) continue;

    const currentVal = Number(current.val);
    const previousVal = Number(previous.val);

    if (!Number.isFinite(currentVal) || !Number.isFinite(previousVal)) {
      continue;
    }

    if (current.resolvedPeriod.kind === "annual" && isWeakAnnualReconstructionSource(current)) {
      continue;
    }

    const start = nextDay(previous.end);
    const end = current.end;

    if (!start || !end) continue;

    const durationDays = diffDaysInclusive(start, end);
    if (durationDays < 75 || durationDays > 120) continue;

    const resolvedPeriod = resolveReconstructedQuarterPeriod({
      source: current,
      start,
      end,
      durationDays,
      fiscalProfile: input.fiscalProfile,
		  periodContext: input.periodContext,
    });

    if (resolvedPeriod.kind !== "quarter") continue;

    if (
      current.resolvedPeriod.kind === "annual" &&
      hasRawDirectQuarterForSameTag({
        current,
        resolvedPeriod,
        rawDirectQuarterIndex: input.rawDirectQuarterIndex,
      })
    ) {
      continue;
    }

    const reconstructedVal = currentVal - previousVal;

    if (
      shouldRejectNegativeReconstructionBySignProfile({
        row: current,
        reconstructedVal,
        signProfileIndex: input.signProfileIndex,
      })
    ) {
      continue;
    }

    if (isInvalidNegativeReconstruction(current, reconstructedVal)) {
      continue;
    }

    results.push({
      ...current,
      val: reconstructedVal,
      start,
      end,
      duration_days: durationDays,
      resolvedPeriod,
      buildSourceKind:
        current.resolvedPeriod.kind === "annual"
          ? "annual_derived"
          : "cumulative_derived",
      workflow_type: "sec_companyfacts_reconstructed_v2",
    });
  }

  return results;
}

function reconstructLeadingQuarterFromCumulative(input: {
  cumulative: MetricBuildCandidate[];
  trailingQuarterIndex: Map<string, MetricBuildCandidate[]>;
  signProfileIndex: Map<string, CompanyMetricSignProfile>;
  fiscalProfile: CompanyFiscalProfile | null;
  periodContext?: PeriodResolveContext;
}): ReconstructedQuarterFlow[] {
  const results: ReconstructedQuarterFlow[] = [];

  for (const current of input.cumulative) {
    if (!current.start || !current.end) continue;

    const trailing = findTrailingQuarterWithSameEnd({
      current,
      trailingQuarterIndex: input.trailingQuarterIndex,
    });

    if (!trailing || !trailing.start || !trailing.end) continue;

    const currentVal = Number(current.val);
    const trailingVal = Number(trailing.val);

    if (!Number.isFinite(currentVal) || !Number.isFinite(trailingVal)) {
      continue;
    }

    const reconstructedVal = currentVal - trailingVal;

    if (
      shouldRejectNegativeReconstructionBySignProfile({
        row: current,
        reconstructedVal,
        signProfileIndex: input.signProfileIndex,
      })
    ) {
      continue;
    }

    if (isInvalidNegativeReconstruction(current, reconstructedVal)) {
      continue;
    }

    const end = previousDay(trailing.start);
    if (!end) continue;

    const durationDays = diffDaysInclusive(current.start, end);
    if (durationDays < 75 || durationDays > 120) continue;

    const resolvedPeriod = resolveReconstructedQuarterPeriod({
      source: current,
      start: current.start,
      end,
      durationDays,
      fiscalProfile: input.fiscalProfile,
	    periodContext: input.periodContext,
    });

    if (resolvedPeriod.kind !== "quarter") continue;

    results.push({
      ...current,
      val: reconstructedVal,
      start: current.start,
      end,
      duration_days: durationDays,
      resolvedPeriod,
      buildSourceKind: "cumulative_derived",
      workflow_type: "sec_companyfacts_reconstructed_v2",
    });
  }

  return results;
}

function resolveReconstructedQuarterPeriod(input: {
  source: MetricBuildCandidate;
  start: Date | string;
  end: Date | string;
  durationDays: number;
  fiscalProfile: CompanyFiscalProfile | null;
  periodContext?: PeriodResolveContext;
}): ResolvedPeriod {
  return resolvePeriod({
    row: {
      ...input.source,
      start: input.start,
      end: input.end,
      duration_days: input.durationDays,
      // Reconstructed quarters inherit their source filing metadata later, but
      // period resolution should be based on the reconstructed window itself.
      fy: null,
      fp: null,
      form: null,
      frame: null,
    },
    fiscalProfile: input.fiscalProfile,
    periodContext: input.periodContext,
  });
}

function findPreviousCumulative(input: {
  current: MetricBuildCandidate;
  previousIndex: Map<string, MetricBuildCandidate[]>;
}): MetricBuildCandidate | null {
  const currentStart = toDateKey(input.current.start);
  const currentEndMs = toUtcDateMs(input.current.end);

  if (!currentStart || currentEndMs == null) {
    return null;
  }

  const matches = input.previousIndex.get(currentStart) ?? [];

  if (matches.length === 0) return null;

  for (let i = matches.length - 1; i >= 0; i--) {
    const candidate = matches[i];
    if (!isSameTag(candidate, input.current)) continue;

    const candidateEndMs = toUtcDateMs(candidate?.end);
    if (candidateEndMs != null && candidateEndMs < currentEndMs) {
      return candidate;
    }
  }

  return null;
}


function nextDay(value: Date | string): string | null {
  const ms = toUtcDateMs(value);
  if (ms == null) return null;

  return new Date(ms + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function previousDay(value: Date | string): string | null {
  const ms = toUtcDateMs(value);
  if (ms == null) return null;

  return new Date(ms - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function diffDaysInclusive(start: Date | string, end: Date | string): number {
  const startMs = toUtcDateMs(start);
  const endMs = toUtcDateMs(end);

  if (startMs == null || endMs == null) return 0;

  return Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
}

function findTrailingQuarterWithSameEnd(input: {
  current: MetricBuildCandidate;
  trailingQuarterIndex: Map<string, MetricBuildCandidate[]>;
}): MetricBuildCandidate | null {
  const currentEnd = toDateKey(input.current.end);
  const currentStartMs = toUtcDateMs(input.current.start);

  if (!currentEnd || currentStartMs == null) {
    return null;
  }

  const matches = input.trailingQuarterIndex.get(currentEnd) ?? [];

  if (matches.length === 0) return null;

  for (const candidate of matches) {
    if (!isSameTag(candidate, input.current)) continue;

    const candidateStartMs = toUtcDateMs(candidate.start);
    if (candidateStartMs != null && candidateStartMs > currentStartMs) {
      return candidate;
    }
  }

  return null;
}

function buildPreviousCumulativeIndex(
  rows: MetricBuildCandidate[],
): Map<string, MetricBuildCandidate[]> {
  const map = new Map<string, MetricBuildCandidate[]>();

  for (const row of rows) {
    const start = toDateKey(row.start);
    const endMs = toUtcDateMs(row.end);
    if (!start || endMs == null) continue;

    const list = map.get(start) ?? [];
    list.push(row);
    map.set(start, list);
  }

  for (const list of map.values()) {
    list.sort((a, b) => (toUtcDateMs(a.end) ?? 0) - (toUtcDateMs(b.end) ?? 0));
  }

  return map;
}

function isSameTag(
  left: MetricBuildCandidate | null | undefined,
  right: MetricBuildCandidate | null | undefined,
): boolean {
  return Boolean(left?.tag && right?.tag && left.tag === right.tag);
}

function isWeakAnnualReconstructionSource(row: MetricBuildCandidate): boolean {
  const form = String(row.form ?? "").toUpperCase();
  return form === "8-K" || form === "6-K";
}

function isInvalidNegativeReconstruction(
  row: MetricBuildCandidate,
  reconstructedVal: number,
): boolean {
  if (reconstructedVal >= 0) return false;

  return NON_NEGATIVE_RECONSTRUCTION_METRICS.has(row.metric_key);
}

const NON_NEGATIVE_RECONSTRUCTION_METRICS = new Set(["revenue"]);

function shouldRejectNegativeReconstructionBySignProfile(input: {
  row: MetricBuildCandidate;
  reconstructedVal: number;
  signProfileIndex: Map<string, CompanyMetricSignProfile>;
}): boolean {
  if (input.reconstructedVal >= 0) return false;
  if (input.row.metric_key !== "capex_cash") return false;

  const profile = input.signProfileIndex.get(
    signProfileKey({
      metricKey: input.row.metric_key,
      tag: input.row.tag,
      unit: input.row.unit,
    }),
  );

  if (!profile) return false;

  return (
    profile.signProfile === "positive_dominant" &&
    profile.expectedSign === "positive" &&
    profile.negativeCount === 0 &&
    profile.confidence >= 0.95
  );
}

function hasRawDirectQuarterForSameTag(input: {
  current: MetricBuildCandidate;
  resolvedPeriod: ResolvedPeriod;
  rawDirectQuarterIndex: Map<string, MetricBuildCandidate[]>;
}): boolean {
  const fiscalYear = input.resolvedPeriod.fiscalYear;
  const fiscalQuarter = input.resolvedPeriod.fiscalQuarter;

  if (fiscalYear == null || fiscalQuarter == null) return false;

  const rows =
    input.rawDirectQuarterIndex.get(
      quarterIndexKey({
        fiscalYear,
        fiscalQuarter,
        tag: input.current.tag,
        unit: input.current.unit,
      }),
    ) ?? [];

  return rows.length > 0;
}

function buildTrailingQuarterIndex(
  rows: MetricBuildCandidate[],
): Map<string, MetricBuildCandidate[]> {
  const map = new Map<string, MetricBuildCandidate[]>();

  for (const row of rows) {
    const end = toDateKey(row.end);
    const startMs = toUtcDateMs(row.start);
    if (!end || startMs == null) continue;

    const list = map.get(end) ?? [];
    list.push(row);
    map.set(end, list);
  }

  for (const list of map.values()) {
    list.sort((a, b) => (toUtcDateMs(a.start) ?? 0) - (toUtcDateMs(b.start) ?? 0));
  }

  return map;
}

function buildRawDirectQuarterIndex(
  rows: MetricBuildCandidate[],
): Map<string, MetricBuildCandidate[]> {
  const map = new Map<string, MetricBuildCandidate[]>();

  for (const row of rows) {
    const fiscalYear = row.resolvedPeriod.fiscalYear;
    const fiscalQuarter = row.resolvedPeriod.fiscalQuarter;

    if (
      row.resolvedPeriod.kind !== "quarter" ||
      row.buildSourceKind !== "raw_direct" ||
      fiscalYear == null ||
      fiscalQuarter == null
    ) {
      continue;
    }

    const key = quarterIndexKey({
      fiscalYear,
      fiscalQuarter,
      tag: row.tag,
      unit: row.unit,
    });

    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }

  return map;
}

function buildSignProfileIndex(
  profiles: CompanyMetricSignProfile[],
): Map<string, CompanyMetricSignProfile> {
  const map = new Map<string, CompanyMetricSignProfile>();

  for (const profile of profiles) {
    map.set(
      signProfileKey({
        metricKey: profile.metricKey,
        tag: profile.tag,
        unit: profile.unit,
      }),
      profile,
    );
  }

  return map;
}

function signProfileKey(input: {
  metricKey: string;
  tag: string;
  unit: string;
}): string {
  return [
    input.metricKey,
    input.tag,
    input.unit,
  ].join("|");
}

function quarterIndexKey(input: {
  fiscalYear: number;
  fiscalQuarter: number;
  tag: string;
  unit: string;
}): string {
  return [
    input.fiscalYear,
    input.fiscalQuarter,
    input.tag,
    input.unit,
  ].join("|");
}
