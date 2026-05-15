// src/backend/services/sec/companyFacts/series/validation/checks/validatePeriodIntegrity.ts

import type {
  SeriesValidationIssue,
  SeriesValidationRow,
} from "../types";

export function validatePeriodIntegrity(
  rows: SeriesValidationRow[],
): SeriesValidationIssue[] {
  const issues: SeriesValidationIssue[] = [];

  for (const row of rows) {
    const { period_type, fiscal_year, fiscal_quarter } = row;

    // 1. period_type 존재 여부
    if (!period_type) {
      issues.push(buildIssue(row, "missing_period_type", "error", "Missing period_type"));
      continue;
    }

    // 2. fiscal_year 필수 (annual / quarter / ytd)
    if (
      (period_type === "annual" ||
        period_type === "quarter" ||
        period_type === "ytd") &&
      fiscal_year == null
    ) {
      issues.push(
        buildIssue(
          row,
          "missing_fiscal_year",
          "error",
          "Missing fiscal_year for non-instant period",
        ),
      );
    }

    // 3. quarter 규칙
    if (period_type === "quarter") {
      if (fiscal_quarter == null) {
        issues.push(
          buildIssue(
            row,
            "missing_fiscal_quarter",
            "error",
            "Quarter row missing fiscal_quarter",
          ),
        );
      } else if (
        fiscal_quarter !== 1 &&
        fiscal_quarter !== 2 &&
        fiscal_quarter !== 3 &&
        fiscal_quarter !== 4
      ) {
        issues.push(
          buildIssue(
            row,
            "invalid_fiscal_quarter",
            "error",
            "Invalid fiscal_quarter value",
          ),
        );
      }
    }

    // 4. annual은 quarter 없어야 함
    if (period_type === "annual" && fiscal_quarter != null) {
      issues.push(
        buildIssue(
          row,
          "annual_with_fiscal_quarter",
          "warning",
          "Annual row should not have fiscal_quarter",
        ),
      );
    }

    // 5. quarter인데 fiscal_year 없음
    if (period_type === "quarter" && fiscal_year == null) {
      issues.push(
        buildIssue(
          row,
          "quarter_without_fiscal_year",
          "error",
          "Quarter row missing fiscal_year",
        ),
      );
    }
  }

  return issues;
}

function buildIssue(
  row: SeriesValidationRow,
  code: SeriesValidationIssue["code"],
  severity: SeriesValidationIssue["severity"],
  message: string,
): SeriesValidationIssue {
  return {
    check: "period_integrity",
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
