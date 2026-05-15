// src/backend/services/sec/companyFacts/series/validation/checks/validateFlowConsistency.ts

import type {
  SeriesValidationIssue,
  SeriesValidationRow,
} from "../types";

const TOLERANCE_RATIO = 0.1; // 10%

export function validateFlowConsistency(
  rows: SeriesValidationRow[],
): SeriesValidationIssue[] {
  const issues: SeriesValidationIssue[] = [];

  const groups = groupByMetric(rows);

  for (const group of groups) {
    if (!group.some((row) => row.fact_type === "flow")) {
      continue;
    }

    const byFiscalYear = groupByFiscalYear(group);

    for (const [fyStr, fyRows] of Object.entries(byFiscalYear)) {
      const fiscalYear = Number(fyStr);

      const quarters = fyRows.filter(
        (r) => r.period_type === "quarter" && r.val != null,
      );

      const annual = fyRows.find(
        (r) => r.period_type === "annual" && r.val != null,
      );

      const ytds = fyRows.filter(
        (r) => r.period_type === "ytd" && r.val != null,
      );

      // 1. annual vs sum(quarters)
      if (annual && quarters.length >= 3) {
        const sum = quarters.reduce((acc, r) => acc + Number(r.val), 0);

        if (!isCloseEnough(Number(annual.val), sum)) {
          issues.push(
            buildIssue(
              annual,
              "annual_less_than_quarter_sum",
              "warning",
              `Annual (${annual.val}) not close to sum of quarters (${sum}) in FY ${fiscalYear}`,
            ),
          );
        }
      }

      // 2. YTD monotonicity
      const sortedYtd = ytds
        .filter((r) => r.fiscal_quarter != null)
        .sort((a, b) => (a.fiscal_quarter! - b.fiscal_quarter!));

      for (let i = 1; i < sortedYtd.length; i++) {
        const prev = sortedYtd[i - 1];
        const curr = sortedYtd[i];

        if (curr.val == null || prev.val == null) continue;

        if (Number(curr.val) < Number(prev.val)) {
          issues.push(
            buildIssue(
              curr,
              "annual_less_than_quarter_sum",
              "warning",
              `YTD decreases from Q${prev.fiscal_quarter} to Q${curr.fiscal_quarter} in FY ${fiscalYear}`,
            ),
          );
        }
      }
    }
  }

  return issues;
}

function isCloseEnough(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;

  const diff = Math.abs(a - b);
  const max = Math.max(Math.abs(a), Math.abs(b), 1);

  return diff / max <= TOLERANCE_RATIO;
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
): SeriesValidationIssue {
  return {
    check: "flow_consistency",
    severity,
    code,
    message,
    metricKey: row.metric_key,
    unit: row.unit,
    fiscalYear: row.fiscal_year,
    fiscalQuarter: row.fiscal_quarter,
    start: row.start,
    end: row.end,
    accn: row.accn,
  };
}
