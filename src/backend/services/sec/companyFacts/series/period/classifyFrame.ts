// src/backend/services/sec/companyFacts/series/period/classifyFrame.ts

import type { FiscalQuarter } from "./types";

export type ParsedCalendarFrame = {
  calendarYear: number;
  calendarQuarter: FiscalQuarter | null;
  isAnnualFrame: boolean;
  isQuarterFrame: boolean;
};

export function parseCalendarFrame(
  frame: string | null | undefined,
): ParsedCalendarFrame | null {
  if (!frame) return null;

  const normalized = frame.trim().toUpperCase();

  const quarterMatch = /^CY(\d{4})Q([1-4])$/.exec(normalized);
  if (quarterMatch) {
    return {
      calendarYear: Number(quarterMatch[1]),
      calendarQuarter: Number(quarterMatch[2]) as FiscalQuarter,
      isAnnualFrame: false,
      isQuarterFrame: true,
    };
  }

  const annualMatch = /^CY(\d{4})$/.exec(normalized);
  if (annualMatch) {
    return {
      calendarYear: Number(annualMatch[1]),
      calendarQuarter: null,
      isAnnualFrame: true,
      isQuarterFrame: false,
    };
  }

  return null;
}

export function isCalendarQuarterFrame(
  frame: string | null | undefined,
): boolean {
  return parseCalendarFrame(frame)?.isQuarterFrame ?? false;
}

export function isCalendarAnnualFrame(
  frame: string | null | undefined,
): boolean {
  return parseCalendarFrame(frame)?.isAnnualFrame ?? false;
}
