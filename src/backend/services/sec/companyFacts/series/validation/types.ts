// src/backend/services/sec/companyFacts/series/validation/types.ts

import type { CompanyFactType } from "@/backend/services/sec/companyFacts/series/types";
import type { FiscalQuarter, PeriodKind } from "@/backend/services/sec/companyFacts/series/period/types";

export type SeriesValidationSeverity = "info" | "warning" | "error";

export type SeriesValidationCheck =
  | "period_integrity"
  | "chronology_integrity"
  | "fiscal_coverage"
  | "flow_consistency"
  | "data_quality"
  | "negative_value";

export type SeriesValidationIssueCode =
  | "missing_period_type"
  | "missing_fiscal_year"
  | "missing_fiscal_quarter"
  | "invalid_fiscal_quarter"
  | "quarter_without_fiscal_year"
  | "annual_with_fiscal_quarter"
  | "duplicate_period"
  | "overlapping_period"
  | "non_monotonic_period"
  | "low_annual_coverage"
  | "low_quarter_coverage"
  | "annual_only_quarter_unavailable"
  | "missing_quarter_in_fiscal_year"
  | "annual_less_than_quarter_sum"
  | "negative_raw_value"
  | "negative_reconstructed_value"
  | "reconstruction_sign_profile_conflict"
  | "null_value"
  | "invalid_duration"
  | "unsupported_period_type";

export type SeriesValidationRow = {
  cik: string;
  ticker: string | null;
  metric_key: string;
  source_tag: string | null;
  fact_type: CompanyFactType;
  unit: string;
  val: number | null;
  start: string | Date | null;
  end: string | Date | null;
  duration_days: number | null;
  fiscal_year: number | null;
  fiscal_quarter: FiscalQuarter | null;
  period_type: PeriodKind | null;
  build_source_kind: string | null;
  workflow_type: string | null;
  sign_profile: string | null;
  expected_sign: string | null;
  sign_profile_confidence: number | null;
  accn: string | null;
  filed: string | Date | null;
};

export type SeriesValidationIssue = {
  check: SeriesValidationCheck;
  severity: SeriesValidationSeverity;
  code: SeriesValidationIssueCode;
  message: string;
  metricKey: string;
  unit: string;
  fiscalYear: number | null;
  fiscalQuarter: FiscalQuarter | null;
  start: string | Date | null;
  end: string | Date | null;
  accn: string | null;
};

export type SeriesValidationResult = {
  cik: string;
  ticker: string | null;
  checkedRowCount: number;
  issueCount: number;
  issues: SeriesValidationIssue[];
};
