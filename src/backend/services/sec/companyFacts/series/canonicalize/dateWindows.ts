import type { BuiltTagSeriesRow } from "@/backend/services/sec/companyFacts/series/types";

export function isWithinAnnualWindow(input: {
  start: number;
  end: number;
  annualStart: number;
  annualEnd: number;
}): boolean {
  return input.start >= input.annualStart && input.end <= input.annualEnd;
}

export function findMissingQuarterWindow(
  annualRow: BuiltTagSeriesRow,
  quarterlies: BuiltTagSeriesRow[],
): { start: string; end: string } | null {
  if (!annualRow.start || quarterlies.length !== 3) {
    return null;
  }

  const sorted = [...quarterlies].sort((a, b) => {
    const aStart = a.start ? new Date(a.start).getTime() : 0;
    const bStart = b.start ? new Date(b.start).getTime() : 0;
    return aStart - bStart;
  });

  const annualStart = new Date(annualRow.start).getTime();
  const annualEnd = new Date(annualRow.end).getTime();

  const windows = sorted.map((row) => ({
    start: row.start ? new Date(row.start).getTime() : NaN,
    end: new Date(row.end).getTime(),
  }));

  if (windows[0] && windows[0].start > annualStart) {
    return {
      start: annualRow.start,
      end: shiftDateString(sorted[0].start!, -1),
    };
  }

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const current = sorted[i];
    const next = sorted[i + 1];

    if (!current.start || !next.start) {
      continue;
    }

    const currentEnd = new Date(current.end).getTime();
    const nextStart = new Date(next.start).getTime();

    if (nextStart > currentEnd + 24 * 60 * 60 * 1000) {
      return {
        start: shiftDateString(current.end, 1),
        end: shiftDateString(next.start, -1),
      };
    }
  }

  const last = sorted[sorted.length - 1];
  if (last) {
    const lastEnd = new Date(last.end).getTime();
    if (annualEnd > lastEnd) {
      return {
        start: shiftDateString(last.end, 1),
        end: annualRow.end,
      };
    }
  }

  return null;
}

export function shiftDateString(
  dateInput: string | Date,
  days: number,
): string {
  let date: Date;

  if (typeof dateInput === "string") {
    const [year, month, day] = dateInput.split("-").map(Number);
    date = new Date(Date.UTC(year, month - 1, day));
  } else {
    date = new Date(dateInput.getTime());
  }

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}
