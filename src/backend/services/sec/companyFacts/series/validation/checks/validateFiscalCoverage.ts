// src/backend/services/sec/companyFacts/series/validation/checks/validateFiscalCoverage.ts

import type {
  SeriesValidationIssue,
  SeriesValidationRow,
} from "../types";
import type { FiscalQuarter } from "@/backend/services/sec/companyFacts/series/period/types";

export function validateFiscalCoverage(
  rows: SeriesValidationRow[],
): SeriesValidationIssue[] {
  const issues: SeriesValidationIssue[] = [];

  const groups = groupByMetric(rows);

  for (const group of groups) {
    issues.push(...validateMissingFiscalYears(group));
    issues.push(...validateMissingAnnualAndQuarters(group));
  }

  return issues;
}

function validateMissingFiscalYears(
  rows: SeriesValidationRow[],
): SeriesValidationIssue[] {
  const fiscalYears = [...new Set(
    rows
      .map((row) => row.fiscal_year)
      .filter((value): value is number => value != null),
  )].sort((a, b) => a - b);

  if (fiscalYears.length < 2) {
    return [];
  }

  const issues: SeriesValidationIssue[] = [];
  const firstRow = rows[0];

  for (let i = 1; i < fiscalYears.length; i++) {
    const previous = fiscalYears[i - 1]!;
    const current = fiscalYears[i]!;

    if (current <= previous + 1) {
      continue;
    }

    for (let missingYear = previous + 1; missingYear < current; missingYear++) {
      issues.push({
        check: "fiscal_coverage",
        severity: "warning",
        code: "missing_fiscal_year",
        message: `Missing fiscal year ${missingYear} between FY${previous} and FY${current}`,
        metricKey: firstRow?.metric_key ?? "",
        unit: firstRow?.unit ?? "",
        fiscalYear: missingYear,
        fiscalQuarter: null,
        start: null,
        end: null,
        accn: null,
      });
    }
  }

  return issues;
}

function validateMissingAnnualAndQuarters(
  rows: SeriesValidationRow[],
): SeriesValidationIssue[] {
  const issues: SeriesValidationIssue[] = [];
  const byFiscalYear = groupByFiscalYear(rows);
  const fiscalYears = Object.keys(byFiscalYear)
    .map((value) => Number(value))
    .sort((a, b) => a - b);

  const earliestFiscalYear = fiscalYears[0] ?? null;
  const latestFiscalYear = fiscalYears.at(-1) ?? null;
  const now = new Date();

  for (const [fy, fyRows] of Object.entries(byFiscalYear)) {
    const fiscalYear = Number(fy);
    const annualRows = fyRows.filter((row) => row.period_type === "annual");
    const quarterRows = fyRows.filter((row) => row.period_type === "quarter");
    const presentQuarters = new Set<FiscalQuarter>(
      quarterRows
        .map((row) => row.fiscal_quarter)
        .filter((value): value is FiscalQuarter => value != null),
    );

    const earliestPolicy = buildEarliestPartialYearPolicy({
      fiscalYear,
      earliestFiscalYear,
      presentQuarters,
    });

    const latestPolicy = buildLatestIncompleteYearPolicy({
      fiscalYear,
      latestFiscalYear,
      fyRows,
      presentQuarters,
      now,
    });

    const requiredQuarterRange = latestPolicy?.requiredQuarterRange
      ?? earliestPolicy?.requiredQuarterRange
      ?? [1, 2, 3, 4];

    const requireAnnual =
      latestPolicy?.requireAnnual
      ?? earliestPolicy?.requireAnnual
      ?? true;

    if (requireAnnual && annualRows.length === 0) {
      issues.push(
        buildIssue(
          fyRows[0],
          "low_annual_coverage",
          "warning",
          `Missing annual data for fiscal year ${fiscalYear}`,
          fiscalYear,
          null,
        ),
      );
    }

    if (
      annualRows.length > 0
      && quarterRows.length === 0
      && requiredQuarterRange.length > 0
    ) {
      issues.push(
        buildIssue(
          annualRows[0] ?? fyRows[0],
          "annual_only_quarter_unavailable",
          "info",
          `Annual data exists for fiscal year ${fiscalYear}, but no quarterly rows are available for this metric/year`,
          fiscalYear,
          null,
        ),
      );
      continue;
    }

    for (const quarter of requiredQuarterRange) {
      if (presentQuarters.has(quarter)) {
        continue;
      }

      issues.push(
        buildIssue(
          fyRows[0],
          "missing_quarter_in_fiscal_year",
          "warning",
          `Missing Q${quarter} in fiscal year ${fiscalYear}`,
          fiscalYear,
          quarter,
        ),
      );
    }
  }

  return issues;
}

function buildEarliestPartialYearPolicy(input: {
  fiscalYear: number;
  earliestFiscalYear: number | null;
  presentQuarters: Set<FiscalQuarter>;
}): {
  requiredQuarterRange: FiscalQuarter[];
  requireAnnual: boolean;
} | null {
  if (input.earliestFiscalYear == null || input.fiscalYear !== input.earliestFiscalYear) {
    return null;
  }

  const quarters = Array.from(input.presentQuarters).sort((a, b) => a - b);
  if (quarters.length === 0) {
    return {
      requiredQuarterRange: [],
      requireAnnual: false,
    };
  }

  const firstQuarter = quarters[0]!;
  if (firstQuarter <= 1) {
    return null;
  }

  return {
    requiredQuarterRange: buildQuarterRange(firstQuarter, 4),
    requireAnnual: false,
  };
}

function buildLatestIncompleteYearPolicy(input: {
  fiscalYear: number;
  latestFiscalYear: number | null;
  fyRows: SeriesValidationRow[];
  presentQuarters: Set<FiscalQuarter>;
  now: Date;
}): {
  requiredQuarterRange: FiscalQuarter[];
  requireAnnual: boolean;
} | null {
  if (input.latestFiscalYear == null || input.fiscalYear !== input.latestFiscalYear) {
    return null;
  }

  const latestEndMs = input.fyRows
    .map((row) => toDateMs(row.end))
    .filter((value): value is number => value != null)
    .sort((a, b) => b - a)[0] ?? null;

  if (latestEndMs == null) {
    return null;
  }

  const ageDays = Math.floor((input.now.getTime() - latestEndMs) / DAY_MS);
  if (ageDays > RECENT_INCOMPLETE_YEAR_MAX_AGE_DAYS) {
    return null;
  }

  const quarters = Array.from(input.presentQuarters).sort((a, b) => a - b);
  const maxQuarter = quarters.at(-1) ?? null;

  if (maxQuarter == null) {
    return {
      requiredQuarterRange: [],
      requireAnnual: false,
    };
  }

  return {
    requiredQuarterRange: buildQuarterRange(1, maxQuarter),
    requireAnnual: maxQuarter === 4,
  };
}

function buildQuarterRange(
  start: FiscalQuarter,
  end: FiscalQuarter,
): FiscalQuarter[] {
  const quarters: FiscalQuarter[] = [];

  for (let quarter = start; quarter <= end; quarter++) {
    quarters.push(quarter as FiscalQuarter);
  }

  return quarters;
}

function groupByMetric(
  rows: SeriesValidationRow[],
): SeriesValidationRow[][] {
  const map = new Map<string, SeriesValidationRow[]>();

  for (const row of rows) {
    const key = `${row.metric_key}|${row.unit}`;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }

  return Array.from(map.values());
}

function groupByFiscalYear(
  rows: SeriesValidationRow[],
): Record<number, SeriesValidationRow[]> {
  const map: Record<number, SeriesValidationRow[]> = {};

  for (const row of rows) {
    if (row.fiscal_year == null) continue;

    if (!map[row.fiscal_year]) {
      map[row.fiscal_year] = [];
    }

    map[row.fiscal_year].push(row);
  }

  return map;
}

function buildIssue(
  row: SeriesValidationRow,
  code: SeriesValidationIssue["code"],
  severity: SeriesValidationIssue["severity"],
  message: string,
  fiscalYear = row.fiscal_year,
  fiscalQuarter = row.fiscal_quarter,
): SeriesValidationIssue {
  return {
    check: "fiscal_coverage",
    severity,
    code,
    message,
    metricKey: row.metric_key,
    unit: row.unit,
    fiscalYear,
    fiscalQuarter,
    start: row.start,
    end: row.end,
    accn: row.accn,
  };
}

function toDateMs(value: string | Date | null | undefined): number | null {
  if (!value) return null;

  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_INCOMPLETE_YEAR_MAX_AGE_DAYS = 400;
