import type { CompanyFactPeriodType } from "@/backend/services/sec/companyFacts/series/types";

export type RawFlowPeriodType = "3m" | "6m" | "9m" | "12m" | "other";

export type QuarterBucket = {
  year: number;
  quarter: 1 | 2 | 3 | 4;
};

export type FlowPeriodRange = {
  min: number;
  max: number;
};

export type FlowPeriodOutlierCluster = {
  center: number;
  min: number;
  max: number;
  count: number;
};

export type FlowPeriodProfile = {
  threeMonth?: FlowPeriodRange | null;
  sixMonth?: FlowPeriodRange | null;
  nineMonth?: FlowPeriodRange | null;
  twelveMonth?: FlowPeriodRange | null;
  outlierClusters?: FlowPeriodOutlierCluster[];
};

const DEFAULT_FLOW_PERIOD_PROFILE: Required<FlowPeriodProfile> = {
  threeMonth: { min: 80, max: 100 },
  sixMonth: { min: 170, max: 200 },
  nineMonth: { min: 250, max: 290 },
  twelveMonth: { min: 350, max: 380 },
  outlierClusters: [],
};

export function classifyRawFlowPeriodType(
  start: string | Date | null,
  end: string | Date | null,
  profile?: FlowPeriodProfile | null,
): RawFlowPeriodType {
  if (!start || !end) {
    return "other";
  }

	const startUtcMs = toUtcDateOnlyMs(start);
	const endUtcMs = toUtcDateOnlyMs(end);

	if (startUtcMs === null || endUtcMs === null) {
		return "other";
	}

	const dayMs = 1000 * 60 * 60 * 24;
	const diffDays = Math.floor((endUtcMs - startUtcMs) / dayMs) + 1;

	if (diffDays < 1) {
		return "other";
	}

  const resolved = resolveFlowPeriodProfile(profile);

  if (
    resolved.threeMonth &&
    diffDays >= resolved.threeMonth.min &&
    diffDays <= resolved.threeMonth.max
  ) {
    return "3m";
  }

  if (
    resolved.sixMonth &&
    diffDays >= resolved.sixMonth.min &&
    diffDays <= resolved.sixMonth.max
  ) {
    return "6m";
  }

  if (
    resolved.nineMonth &&
    diffDays >= resolved.nineMonth.min &&
    diffDays <= resolved.nineMonth.max
  ) {
    return "9m";
  }

  if (
    resolved.twelveMonth &&
    diffDays >= resolved.twelveMonth.min &&
    diffDays <= resolved.twelveMonth.max
  ) {
    return "12m";
  }

  return "other";
}

function resolveFlowPeriodProfile(
  profile?: FlowPeriodProfile | null,
): Required<FlowPeriodProfile> {
  return {
    threeMonth: profile?.threeMonth ?? DEFAULT_FLOW_PERIOD_PROFILE.threeMonth,
    sixMonth: profile?.sixMonth ?? DEFAULT_FLOW_PERIOD_PROFILE.sixMonth,
    nineMonth: profile?.nineMonth ?? DEFAULT_FLOW_PERIOD_PROFILE.nineMonth,
    twelveMonth: profile?.twelveMonth ?? DEFAULT_FLOW_PERIOD_PROFILE.twelveMonth,
    outlierClusters:
      profile?.outlierClusters ?? DEFAULT_FLOW_PERIOD_PROFILE.outlierClusters,
  };
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
  periodType: "quarterly" | "annual",
  start: string | Date | null,
  end: string | Date,
): string | null {
  if (periodType === "annual") {
    const endKey = toDateKey(end);
    if (!endKey) return null;

    return `CY${endKey.slice(0, 4)}`;
  }

  return deriveQuarterFrameByMaxOverlap(start, end);
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

function deriveQuarterFrameByMaxOverlap(
  start: string | Date | null,
  end: string | Date,
): string | null {
  const startMs = toUtcDateOnlyMs(start);
  const endMs = toUtcDateOnlyMs(end);

  if (startMs === null || endMs === null || endMs < startMs) {
    return null;
  }

  const startYear = new Date(startMs).getUTCFullYear();
  const endYear = new Date(endMs).getUTCFullYear();

  let bestFrame: string | null = null;
  let bestOverlapDays = -1;

  for (let year = startYear; year <= endYear; year += 1) {
    for (let quarter = 1; quarter <= 4; quarter += 1) {
      const quarterStartMs = Date.UTC(year, (quarter - 1) * 3, 1);
      const quarterEndMs = Date.UTC(year, quarter * 3, 0);

      const overlapStart = Math.max(startMs, quarterStartMs);
      const overlapEnd = Math.min(endMs, quarterEndMs);

      if (overlapEnd < overlapStart) {
        continue;
      }

      const overlapDays = diffInclusiveDays(overlapStart, overlapEnd);

      if (overlapDays > bestOverlapDays) {
        bestOverlapDays = overlapDays;
        bestFrame = `CY${year}Q${quarter}`;
      }
    }
  }

  return bestFrame;
}

function diffInclusiveDays(startMs: number, endMs: number): number {
  const dayMs = 1000 * 60 * 60 * 24;
  return Math.floor((endMs - startMs) / dayMs) + 1;
}

function toUtcDateOnlyMs(value: string | Date | null | undefined): number | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
    );
  }

  const [yearText, monthText, dayText] = value.slice(0, 10).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return Date.UTC(year, month - 1, day);
}


function toDateKey(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}


export function deriveAnnualDisplayFrame(
  end: string | Date | null,
): string | null {
  if (!end) {
    return null;
  }

  const date = normalizeDate(end);
  if (!date) {
    return null;
  }

  return `CY${date.getUTCFullYear()}`;
}

function normalizeDate(value: string | Date): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

