// src/backend/services/sec/companyFacts/series/validation/validateMetricSeries.ts

import type {
  SeriesValidationResult,
  SeriesValidationRow,
} from "./types";

import { validateChronologyIntegrity } from "./checks/validateChronologyIntegrity";
import { validateDataQuality } from "./checks/validateDataQuality";
import { validateFiscalCoverage } from "./checks/validateFiscalCoverage";
import { validateFlowConsistency } from "./checks/validateFlowConsistency";
import { validateNegativeValues } from "./checks/validateNegativeValues";
import { validatePeriodIntegrity } from "./checks/validatePeriodIntegrity";

export function validateMetricSeries(input: {
  cik: string;
  ticker: string | null;
  rows: SeriesValidationRow[];
}): SeriesValidationResult {
  const { cik, ticker, rows } = input;

  const issues = [
    ...validateDataQuality(rows),
    ...validatePeriodIntegrity(rows),
    ...validateChronologyIntegrity(rows),
    ...validateFiscalCoverage(rows),
    ...validateFlowConsistency(rows),
    ...validateNegativeValues(rows),
  ];

  return {
    cik,
    ticker,
    checkedRowCount: rows.length,
    issueCount: issues.length,
    issues,
  };
}
