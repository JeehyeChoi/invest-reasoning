// src/backend/services/sec/companyFacts/series/period/dateUtils.ts

import { calculateDurationDays } from "@/backend/services/sec/companyFacts/series/utils/duration";
import {
  toDateKey,
  toUtcDateMs,
} from "@/backend/services/sec/companyFacts/series/utils/dateKey";

export function normalizePeriodDateKey(
  value: string | Date | null | undefined,
): string | null {
  const key = toDateKey(value);
  return key === "" ? null : key;
}

export function getPeriodDurationDays(input: {
  start: string | Date | null | undefined;
  end: string | Date | null | undefined;
  durationDays?: number | null;
}): number | null {
  if (input.durationDays !== undefined && input.durationDays !== null) {
    return input.durationDays;
  }

  return calculateDurationDays(input.start, input.end);
}

export function diffPeriodDays(
  a: string | Date | null | undefined,
  b: string | Date | null | undefined,
): number | null {
  const aMs = toUtcDateMs(a);
  const bMs = toUtcDateMs(b);

  if (aMs === null || bMs === null) {
    return null;
  }

  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((aMs - bMs) / dayMs);
}

export function absDiffPeriodDays(
  a: string | Date | null | undefined,
  b: string | Date | null | undefined,
): number | null {
  const diff = diffPeriodDays(a, b);
  return diff === null ? null : Math.abs(diff);
}

export function isDateWithinInclusiveRange(input: {
  date: string | Date | null | undefined;
  start: string | Date | null | undefined;
  end: string | Date | null | undefined;
}): boolean {
  const dateMs = toUtcDateMs(input.date);
  const startMs = toUtcDateMs(input.start);
  const endMs = toUtcDateMs(input.end);

  if (dateMs === null || startMs === null || endMs === null) {
    return false;
  }

  return dateMs >= startMs && dateMs <= endMs;
}

export function isPeriodWithinInclusiveRange(input: {
  start: string | Date | null | undefined;
  end: string | Date | null | undefined;
  expectedStart: string | Date | null | undefined;
  expectedEnd: string | Date | null | undefined;
}): boolean {
  const startMs = toUtcDateMs(input.start);
  const endMs = toUtcDateMs(input.end);
  const expectedStartMs = toUtcDateMs(input.expectedStart);
  const expectedEndMs = toUtcDateMs(input.expectedEnd);

  if (
    startMs === null ||
    endMs === null ||
    expectedStartMs === null ||
    expectedEndMs === null
  ) {
    return false;
  }

  return startMs >= expectedStartMs && endMs <= expectedEndMs;
}
