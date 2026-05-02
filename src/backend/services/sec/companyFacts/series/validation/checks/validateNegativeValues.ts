import type {
  SeriesValidationIssue,
  SeriesValidationRow,
} from "../types";

const RECONSTRUCTED_SOURCE_KINDS = new Set([
  "annual_derived",
  "cumulative_derived",
  "segment_merged",
  "other_merged",
]);

const SIGNED_METRIC_KEYS = new Set([
  "net_income",
  "operating_income",
  "operating_cash_flow",
  "investing_cash_flow",
  "financing_cash_flow",
  "dividend_payments",
  "income_tax_expense",
  "net_interest_nonoperating",
]);

export function validateNegativeValues(
  rows: SeriesValidationRow[],
): SeriesValidationIssue[] {
  const issues: SeriesValidationIssue[] = [];

  for (const row of rows) {
    if (row.val == null || row.val >= 0) {
      continue;
    }

    if (SIGNED_METRIC_KEYS.has(row.metric_key)) {
      continue;
    }

    const sourceKind = row.build_source_kind ?? "unknown";
    const isReconstructed = RECONSTRUCTED_SOURCE_KINDS.has(sourceKind);
    const conflictsWithPositiveSignProfile =
      isReconstructed &&
      row.sign_profile === "positive_dominant" &&
      row.expected_sign === "positive";

    issues.push({
      check: "negative_value",
      severity: isReconstructed ? "warning" : "info",
      code: conflictsWithPositiveSignProfile
        ? "reconstruction_sign_profile_conflict"
        : isReconstructed
          ? "negative_reconstructed_value"
          : "negative_raw_value",
      message: conflictsWithPositiveSignProfile
        ? `Negative ${row.metric_key} value was produced by ${sourceKind}, but source tag ${row.source_tag ?? "unknown"} is positive_dominant; inspect period assignment and reconstruction inputs`
        : isReconstructed
          ? `Negative ${row.metric_key} value was produced by ${sourceKind}; inspect reconstruction inputs`
          : `Negative ${row.metric_key} value came from ${sourceKind}; likely source sign convention`,
      metricKey: row.metric_key,
      unit: row.unit,
      fiscalYear: row.fiscal_year,
      fiscalQuarter: row.fiscal_quarter,
      start: row.start,
      end: row.end,
      accn: row.accn,
    });
  }

  return issues;
}
