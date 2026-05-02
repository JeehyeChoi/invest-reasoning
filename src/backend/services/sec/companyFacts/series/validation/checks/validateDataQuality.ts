// src/backend/services/sec/companyFacts/series/validation/checks/validateDataQuality.ts

import type {
  SeriesValidationIssue,
  SeriesValidationRow,
} from "../types";

const MAX_REASONABLE_DURATION = 400; // annual upper bound
const MIN_REASONABLE_DURATION = 0;

export function validateDataQuality(
  rows: SeriesValidationRow[],
): SeriesValidationIssue[] {
  const issues: SeriesValidationIssue[] = [];

  for (const row of rows) {
    const {
      val,
      duration_days,
      period_type,
    } = row;

    // 1. null value
    if (val == null) {
      issues.push(
        buildIssue(
          row,
          "null_value",
          "warning",
          "Value is null",
        ),
      );
    }

    // 2. invalid duration
    if (
      duration_days != null &&
      (duration_days < MIN_REASONABLE_DURATION ||
        duration_days > MAX_REASONABLE_DURATION)
    ) {
      issues.push(
        buildIssue(
          row,
          "invalid_duration",
          "warning",
          `Unusual duration_days: ${duration_days}`,
        ),
      );
    }

    // 3. period_type sanity
    if (
      period_type !== "annual" &&
      period_type !== "quarter" &&
      period_type !== "ytd" &&
      period_type !== "instant" &&
      period_type !== "other"
    ) {
      issues.push(
        buildIssue(
          row,
          "unsupported_period_type",
          "error",
          `Unsupported period_type: ${String(period_type)}`,
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
    check: "data_quality",
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
