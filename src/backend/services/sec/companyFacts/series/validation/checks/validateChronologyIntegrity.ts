// src/backend/services/sec/companyFacts/series/validation/checks/validateChronologyIntegrity.ts

import type {
  SeriesValidationIssue,
  SeriesValidationRow,
} from "../types";
import { toUtcDateMs } from "@/backend/services/sec/companyFacts/series/utils/dateKey";

export function validateChronologyIntegrity(
  rows: SeriesValidationRow[],
): SeriesValidationIssue[] {
  const issues: SeriesValidationIssue[] = [];

  const groups = groupByMetric(rows);

  for (const group of groups) {
    const sorted = group
      .filter((r) => r.start && r.end)
      .sort((a, b) => {
        return (
          (toUtcDateMs(a.start) ?? 0) -
          (toUtcDateMs(b.start) ?? 0)
        );
      });

    const seen = new Set<string>();

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];

      const key = `${current.start}|${current.end}`;

      // 1. duplicate
      if (seen.has(key)) {
        issues.push(
          buildIssue(
            current,
            "duplicate_period",
            "warning",
            "Duplicate period detected",
          ),
        );
      }
      seen.add(key);

      // 2. overlap
      if (i > 0) {
        const prev = sorted[i - 1];

        const prevEnd = toUtcDateMs(prev.end);
        const currStart = toUtcDateMs(current.start);

        if (
          prevEnd != null &&
          currStart != null &&
          currStart < prevEnd
        ) {
          issues.push(
            buildIssue(
              current,
              "overlapping_period",
              "warning",
              "Overlapping periods detected",
            ),
          );
        }
      }

      // 3. non-monotonic (end 기준 역전)
      if (i > 0) {
        const prev = sorted[i - 1];

        const prevEnd = toUtcDateMs(prev.end);
        const currEnd = toUtcDateMs(current.end);

        if (
          prevEnd != null &&
          currEnd != null &&
          currEnd < prevEnd
        ) {
          issues.push(
            buildIssue(
              current,
              "non_monotonic_period",
              "warning",
              "End date decreases (non-monotonic)",
            ),
          );
        }
      }
    }
  }

  return issues;
}

function groupByMetric(
  rows: SeriesValidationRow[],
): SeriesValidationRow[][] {
  const map = new Map<string, SeriesValidationRow[]>();

  for (const row of rows) {
    const key = `${row.metric_key}|${row.unit}|${row.period_type ?? "unknown"}`;

    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }

  return Array.from(map.values());
}

function buildIssue(
  row: SeriesValidationRow,
  code: SeriesValidationIssue["code"],
  severity: SeriesValidationIssue["severity"],
  message: string,
): SeriesValidationIssue {
  return {
    check: "chronology_integrity",
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
