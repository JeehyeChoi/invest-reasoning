// src/backend/services/sec/companyFacts/series/validation/buildSeriesValidationReport.ts

import type {
  SeriesValidationResult,
  SeriesValidationIssue,
} from "./types";

export function buildSeriesValidationReport(
  result: SeriesValidationResult,
) {
  const bySeverity = groupBySeverity(result.issues);

  return {
    cik: result.cik,
    ticker: result.ticker,
    checkedRowCount: result.checkedRowCount,
    issueCount: result.issueCount,

    errorCount: bySeverity.error.length,
    warningCount: bySeverity.warning.length,
    infoCount: bySeverity.info.length,

    issues: result.issues,
  };
}

function groupBySeverity(issues: SeriesValidationIssue[]) {
  return {
    error: issues.filter((i) => i.severity === "error"),
    warning: issues.filter((i) => i.severity === "warning"),
    info: issues.filter((i) => i.severity === "info"),
  };
}
