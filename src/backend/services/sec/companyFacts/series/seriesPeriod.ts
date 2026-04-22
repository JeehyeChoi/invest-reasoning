import type { CompanyFactPeriodType } from "@/backend/services/sec/companyFacts/series/types";

export type RawFlowPeriodType = "3m" | "6m" | "9m" | "12m" | "other";

export type QuarterBucket = {
  year: number;
  quarter: 1 | 2 | 3 | 4;
};

export function classifyRawFlowPeriodType(
  start: string | Date | null,
  end: string | Date | null,
): RawFlowPeriodType {
  if (!start || !end) {
    return "other";
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "other";
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return "other";
  }

  if (diffDays >= 80 && diffDays <= 100) {
    return "3m";
  }

  if (diffDays >= 170 && diffDays <= 200) {
    return "6m";
  }

  if (diffDays >= 250 && diffDays <= 290) {
    return "9m";
  }

  if (diffDays >= 350 && diffDays <= 380) {
    return "12m";
  }

  return "other";
}

export function buildQuarterBucketKey(bucket: QuarterBucket): string {
  return `${bucket.year}__Q${bucket.quarter}`;
}

export function parseQuarterBucketKey(key: string): QuarterBucket | null {
  const [yearText, quarterText] = key.split("__");
  const year = Number(yearText);
  const quarter = Number(quarterText.replace("Q", ""));

  if (!Number.isFinite(year) || !Number.isFinite(quarter)) {
    return null;
  }

  if (quarter < 1 || quarter > 4) {
    return null;
  }

  return {
    year,
    quarter: quarter as 1 | 2 | 3 | 4,
  };
}

export function deriveFrame(
  periodType: CompanyFactPeriodType,
  start: string | Date | null,
  end: string | Date | null,
): string | null {
  if (periodType === "instant" || periodType === "other") {
    return null;
  }

  if (periodType === "annual") {
    return deriveAnnualDisplayFrame(start);
  }

  if (periodType === "quarterly") {
    return deriveQuarterlyDisplayFrame(start, end);
  }

  return null;
}

export function deriveBucketFromStartAndPeriod(
  start: string | Date | null,
  rawPeriodType: RawFlowPeriodType,
): QuarterBucket | null {
  if (!start) {
    return null;
  }

  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  const year = startDate.getUTCFullYear();
  const month = startDate.getUTCMonth() + 1;

  const startQuarter =
    month <= 3 ? 1 :
    month <= 6 ? 2 :
    month <= 9 ? 3 : 4;

  let quarter = startQuarter;

  if (rawPeriodType === "6m") {
    quarter = startQuarter + 1;
  }

  if (rawPeriodType === "9m") {
    quarter = startQuarter + 2;
  }

  if (rawPeriodType === "12m") {
    quarter = startQuarter + 3;
  }

  if (quarter > 4) {
    return null;
  }

  return {
    year,
    quarter: quarter as 1 | 2 | 3 | 4,
  };
}

export function deriveQuarterlyDisplayFrame(
  start: string | Date | null,
  end: string | Date | null,
): string | null {
  if (!start || !end) {
    return null;
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  const midpoint = new Date(
    startDate.getTime() + (endDate.getTime() - startDate.getTime()) / 2,
  );

  const year = midpoint.getUTCFullYear();
  const month = midpoint.getUTCMonth() + 1;

  const quarter =
    month <= 3 ? "Q1" :
    month <= 6 ? "Q2" :
    month <= 9 ? "Q3" :
    "Q4";

  return `CY${year}${quarter}`;
}

export function deriveAnnualDisplayFrame(
  start: string | Date | null,
): string | null {
  if (!start) {
    return null;
  }

  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) {
    return null;
  }

  return `CY${startDate.getUTCFullYear()}`;
}
