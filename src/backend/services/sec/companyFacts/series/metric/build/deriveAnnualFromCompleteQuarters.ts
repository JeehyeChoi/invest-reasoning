import type { MetricBuildCandidate } from "./types";
import type { FiscalQuarter, ResolvedPeriod } from "@/backend/services/sec/companyFacts/series/period/types";
import { diffDaysInclusive } from "./candidateUtils";
import { toDateKey } from "@/backend/services/sec/companyFacts/series/utils/dateKey";

export type QuarterSumAnnualFlow = MetricBuildCandidate & {
  workflow_type: "sec_companyfacts_quarter_sum_annual_v1";
};

export function deriveAnnualFromCompleteQuarters(input: {
  annualRows: MetricBuildCandidate[];
  quarterRows: MetricBuildCandidate[];
}): QuarterSumAnnualFlow[] {
  const annualYears = new Set(
    input.annualRows
      .map((row) => row.resolvedPeriod.fiscalYear)
      .filter((value): value is number => value != null),
  );

  const quarterGroups = groupByFiscalYear(input.quarterRows);
  const results: QuarterSumAnnualFlow[] = [];

  for (const [fiscalYearKey, rows] of quarterGroups.entries()) {
    const fiscalYear = Number(fiscalYearKey);
    if (annualYears.has(fiscalYear)) continue;

    const byQuarter = new Map<FiscalQuarter, MetricBuildCandidate>();
    for (const row of rows) {
      const quarter = row.resolvedPeriod.fiscalQuarter;
      if (quarter == null) continue;
      byQuarter.set(quarter, row);
    }

    const quarters = [1, 2, 3, 4]
      .map((quarter) => byQuarter.get(quarter as FiscalQuarter))
      .filter((row): row is MetricBuildCandidate => row != null);

    if (quarters.length !== 4) continue;
    if (!canSafelySumQuarters(quarters)) continue;

    const first = quarters[0]!;
    const last = quarters[3]!;
    if (!first.start || !last.end) continue;

    const value = quarters.reduce((sum, row) => sum + Number(row.val), 0);
    if (!Number.isFinite(value)) continue;

    const durationDays = diffDaysInclusive(first.start, last.end);
    if (durationDays == null) continue;

    results.push({
      ...last,
      val: value,
      start: first.start,
      end: last.end,
      duration_days: durationDays,
      resolvedPeriod: buildAnnualResolvedPeriod({
        fiscalYear,
        start: first.start,
        end: last.end,
        quarters,
      }),
      buildSourceKind: "annual_derived",
      workflow_type: "sec_companyfacts_quarter_sum_annual_v1",
    });
  }

  return results;
}

function canSafelySumQuarters(rows: MetricBuildCandidate[]): boolean {
  const [first] = rows;
  if (!first) return false;

  for (const row of rows) {
    if (row.resolvedPeriod.kind !== "quarter") return false;
    if (row.buildSourceKind === "raw_partial") return false;
    if (
      row.resolvedPeriod.windowMatchKind !== "exact" &&
      row.resolvedPeriod.windowMatchKind !== "near"
    ) {
      return false;
    }
    if (row.tag !== first.tag) return false;
    if (row.unit !== first.unit) return false;
    if (row.metric_key !== first.metric_key) return false;
  }

  return true;
}

function buildAnnualResolvedPeriod(input: {
  fiscalYear: number;
  start: string | Date;
  end: string | Date;
  quarters: MetricBuildCandidate[];
}): ResolvedPeriod {
  const confidence = Math.min(...input.quarters.map((row) => row.resolvedPeriod.confidence));
  const fitScore = Math.min(...input.quarters.map((row) => row.resolvedPeriod.fitScore));
  const exact = input.quarters.every((row) => row.resolvedPeriod.windowMatchKind === "exact");

  return {
    kind: "annual",
    fiscalYear: input.fiscalYear,
    fiscalQuarter: null,
    calendarYear: null,
    calendarQuarter: null,
    expectedStart: toDateKey(input.start),
    expectedEnd: toDateKey(input.end),
    confidence,
    fitScore,
    windowMatchKind: exact ? "exact" : "near",
    secLabelAlignment: "unknown",
    basis: "annual_window",
    issues: [],
  };
}

function groupByFiscalYear(rows: MetricBuildCandidate[]): Map<string, MetricBuildCandidate[]> {
  const map = new Map<string, MetricBuildCandidate[]>();

  for (const row of rows) {
    const fiscalYear = row.resolvedPeriod.fiscalYear;
    if (fiscalYear == null) continue;

    const key = String(fiscalYear);
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }

  return map;
}
