// src/backend/services/sec/companyFacts/series/period/classifyDuration.ts

import type { PeriodKind } from "./types";

export type DurationClassification = {
  kind: PeriodKind;
  confidence: number;
  issues: string[];
};

const ANNUAL_MIN = 330;
const ANNUAL_MAX = 400;

const QUARTER_MIN = 75;
const QUARTER_MAX = 120;

const YTD_MIN = 130;  // ~6 months+
const YTD_MAX = 300;

export function classifyDurationDays(
  durationDays: number | null | undefined,
): DurationClassification {
  if (durationDays === null || durationDays === undefined) {
    return {
      kind: "other",
      confidence: 0,
      issues: ["missing_duration"],
    };
  }

  // Annual
  if (durationDays >= ANNUAL_MIN && durationDays <= ANNUAL_MAX) {
    return {
      kind: "annual",
      confidence: 0.9,
      issues: [],
    };
  }

  // Quarter
  if (durationDays >= QUARTER_MIN && durationDays <= QUARTER_MAX) {
    return {
      kind: "quarter",
      confidence: 0.9,
      issues: [],
    };
  }

  // YTD (half-year / 9 months)
  if (durationDays >= YTD_MIN && durationDays <= YTD_MAX) {
    return {
      kind: "ytd",
      confidence: 0.7,
      issues: [],
    };
  }

  // Instant (balance sheet etc.)
  if (durationDays === 0) {
    return {
      kind: "instant",
      confidence: 1,
      issues: [],
    };
  }

  return {
    kind: "other",
    confidence: 0.3,
    issues: [],
  };
}
