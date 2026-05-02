// src/backend/services/sec/companyFacts/series/validation/validateMetricSeries.ts

import type {
  SeriesValidationResult,
  SeriesValidationRow,
} from "./types";

import { validateFiscalCoverage } from "./checks/validateFiscalCoverage";
import { validateNegativeValues } from "./checks/validateNegativeValues";

export function validateMetricSeries(input: {
  cik: string;
  ticker: string | null;
  rows: SeriesValidationRow[];
}): SeriesValidationResult {
  const { cik, ticker, rows } = input;

  const issues = [
    ...validateFiscalCoverage(rows),
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
