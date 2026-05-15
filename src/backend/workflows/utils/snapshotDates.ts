export type SnapshotFrequency = "month_end" | "quarter_end" | "year_end";

export type SnapshotDateInput = {
  snapshotDates?: string[];
  startDate?: string;
  endDate?: string;
  frequency?: SnapshotFrequency;
  defaultToTimeline?: boolean;
  defaultLookbackYears?: number;
};

export function resolveSnapshotDates(input: SnapshotDateInput): string[] {
  if (input.snapshotDates?.length) {
    return Array.from(new Set(input.snapshotDates.map(toDateKey))).sort();
  }

  if (!input.startDate || !input.endDate) {
    return input.defaultToTimeline ? buildDefaultSnapshotDates(input) : [];
  }

  return buildSnapshotDates({
    startDate: input.startDate,
    endDate: input.endDate,
    frequency: input.frequency ?? "quarter_end",
  });
}

function buildDefaultSnapshotDates(input: SnapshotDateInput): string[] {
  const frequency = input.frequency ?? "quarter_end";
  const lookbackYears = input.defaultLookbackYears ?? 30;
  const end = previousCompletedPeriodEnd(new Date(), frequency);
  const start = new Date(Date.UTC(
    end.getUTCFullYear() - lookbackYears,
    end.getUTCMonth() + 1,
    1,
  ));

  return buildSnapshotDates({
    startDate: toDateKey(start),
    endDate: toDateKey(end),
    frequency,
  });
}

function previousCompletedPeriodEnd(
  now: Date,
  frequency: SnapshotFrequency,
): Date {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  if (frequency === "month_end") {
    return new Date(Date.UTC(year, month - 1, 0));
  }

  if (frequency === "year_end") {
    return new Date(Date.UTC(year - 1, 12, 0));
  }

  const completedQuarterEndMonth = Math.floor((month - 1) / 3) * 3;
  if (completedQuarterEndMonth === 0) {
    return new Date(Date.UTC(year - 1, 12, 0));
  }

  return new Date(Date.UTC(year, completedQuarterEndMonth, 0));
}

function buildSnapshotDates(input: {
  startDate: string;
  endDate: string;
  frequency: SnapshotFrequency;
}): string[] {
  const start = parseDate(input.startDate);
  const end = parseDate(input.endDate);
  const dates: string[] = [];

  for (
    let year = start.getUTCFullYear();
    year <= end.getUTCFullYear();
    year += 1
  ) {
    for (const month of monthsForFrequency(input.frequency)) {
      const date = new Date(Date.UTC(year, month, 0));
      if (date < start || date > end) continue;
      dates.push(toDateKey(date));
    }
  }

  return dates;
}

function monthsForFrequency(frequency: SnapshotFrequency): number[] {
  if (frequency === "month_end") return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  if (frequency === "year_end") return [12];
  return [3, 6, 9, 12];
}

function parseDate(value: string): Date {
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid snapshot date: ${value}`);
  }

  return date;
}

function toDateKey(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);

  return parseDate(value).toISOString().slice(0, 10);
}
