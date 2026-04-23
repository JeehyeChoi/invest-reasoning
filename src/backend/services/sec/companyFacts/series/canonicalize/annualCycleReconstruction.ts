import type { BuiltTagSeriesRow } from "@/backend/services/sec/companyFacts/series/types";
import type { BuildAnnualCycleRowsInput } from "@/backend/services/sec/companyFacts/series/canonicalize/annualCycleTypes";
import { deriveFrame } from "@/backend/services/sec/companyFacts/series/canonicalize/flowPeriod";
import { shiftDateString } from "@/backend/services/sec/companyFacts/series/canonicalize/dateWindows";
import { normalizeQuarterliesByContinuity } from "@/backend/services/sec/companyFacts/series/canonicalize/quarterContinuity";

export function buildAnnualCycleRows({
  annualRow,
  directQuarterlies,
  cumulative6m,
  cumulative9m,
  trailing6m,
  input,
}: BuildAnnualCycleRowsInput): BuiltTagSeriesRow[] {
  if (!annualRow.start) {
    return directQuarterlies;
  }

  const dayAfter = (date: string) => shiftDateString(date, 1);
  const dayBefore = (date: string) => shiftDateString(date, -1);

	const sortedDirect = normalizeQuarterliesByContinuity(directQuarterlies);

  let q1: BuiltTagSeriesRow | null = null;
  let q2: BuiltTagSeriesRow | null = null;
  let q3: BuiltTagSeriesRow | null = null;
  let q4: BuiltTagSeriesRow | null = null;

  const middleDirect: BuiltTagSeriesRow[] = [];

  for (const row of sortedDirect) {
		if (isSameDate(row.start, annualRow.start)) {
			q1 = choosePreferredQuarter(q1, row);
			continue;
		}

		if (isSameDate(row.end, annualRow.end)) {
			q4 = choosePreferredQuarter(q4, row);
			continue;
		}

    middleDirect.push(row);
  }

  if (middleDirect.length === 2) {
    const [first, second] = middleDirect;

		if (cumulative6m && isSameDate(first.end, cumulative6m.end)) {
			q2 = choosePreferredQuarter(q2, first);
		} else if (cumulative6m && isSameDate(second.end, cumulative6m.end)) {
			q2 = choosePreferredQuarter(q2, second);
		}

		if (cumulative9m && isSameDate(first.end, cumulative9m.end)) {
			q3 = choosePreferredQuarter(q3, first);
		} else if (cumulative9m && isSameDate(second.end, cumulative9m.end)) {
			q3 = choosePreferredQuarter(q3, second);
		} else if (trailing6m?.start && isSameDate(first.start, trailing6m.start)) {
			q3 = choosePreferredQuarter(q3, first);
		} else if (trailing6m?.start && isSameDate(second.start, trailing6m.start)) {
			q3 = choosePreferredQuarter(q3, second);
		}

    if (q2 && !q3) {
      q3 = first === q2 ? second : first;
    } else if (q3 && !q2) {
      q2 = first === q3 ? second : first;
    }
  } else if (middleDirect.length === 1) {
    const only = middleDirect[0];

		if (cumulative6m && isSameDate(only.end, cumulative6m.end)) {
			q2 = choosePreferredQuarter(q2, only);
		} else if (cumulative9m && isSameDate(only.end, cumulative9m.end)) {
			q3 = choosePreferredQuarter(q3, only);
		} else if (trailing6m?.start && isSameDate(only.start, trailing6m.start)) {
			q3 = choosePreferredQuarter(q3, only);
		}
  }

  if (!q4 && cumulative9m) {
    const q4Start = q3?.end ? dayAfter(q3.end) : dayAfter(cumulative9m.end);
    const q4End = annualRow.end;
    const q4Val = annualRow.val - cumulative9m.val;

    if (Number.isFinite(q4Val)) {
      q4 = buildReconstructedQuarterRow({
        annualRow,
        start: q4Start,
        end: q4End,
        val: q4Val,
        input,
      });
    }
  }

  if (!q3) {
    if (cumulative9m && cumulative6m) {
      const q3Start = q2?.end ? dayAfter(q2.end) : dayAfter(cumulative6m.end);
      const q3End = q4?.start ? dayBefore(q4.start) : cumulative9m.end;
      const q3Val = cumulative9m.val - cumulative6m.val;

      if (Number.isFinite(q3Val)) {
        q3 = buildReconstructedQuarterRow({
          annualRow,
          start: q3Start,
          end: q3End,
          val: q3Val,
          input,
        });
      }
    } else if (trailing6m?.start && q4) {
      const q3Start = trailing6m.start;
      const q3End = q4.start ? dayBefore(q4.start) : trailing6m.end;
      const q3Val = trailing6m.val - q4.val;

      if (Number.isFinite(q3Val)) {
        q3 = buildReconstructedQuarterRow({
          annualRow,
          start: q3Start,
          end: q3End,
          val: q3Val,
          input,
        });
      }
    }
  }

  if (!q2) {
    if (q1 && q3 && q4 && q3.start) {
      const q2Start = dayAfter(q1.end);
      const q2End = dayBefore(q3.start);
      const q2Val = annualRow.val - (q1.val + q3.val + q4.val);

      if (Number.isFinite(q2Val)) {
        q2 = buildReconstructedQuarterRow({
          annualRow,
          start: q2Start,
          end: q2End,
          val: q2Val,
          input,
        });
      }
    } else if (cumulative6m && q1) {
      const q2Start = dayAfter(q1.end);
      const q2End = q3?.start ? dayBefore(q3.start) : cumulative6m.end;
      const q2Val = cumulative6m.val - q1.val;

      if (Number.isFinite(q2Val)) {
        q2 = buildReconstructedQuarterRow({
          annualRow,
          start: q2Start,
          end: q2End,
          val: q2Val,
          input,
        });
      }
    }
  }

  if (!q1 && cumulative6m && q2 && q2.start) {
    const q1Start = annualRow.start;
    const q1End = dayBefore(q2.start);
    const q1Val = cumulative6m.val - q2.val;

    if (Number.isFinite(q1Val)) {
      q1 = buildReconstructedQuarterRow({
        annualRow,
        start: q1Start,
        end: q1End,
        val: q1Val,
        input,
      });
    }
  }

  return [q1, q2, q3, q4].filter(
    (row): row is BuiltTagSeriesRow => {
      if (!row) {
        return false;
      }

      return (
        row.workflow_type === "sec_companyfacts_reconstructed_v1" ||
        isReasonableQuarterRow(row)
      );
    },
  );
}

export function buildReconstructedQuarterRow({
  annualRow,
  start,
  end,
  val,
  input,
}: {
  annualRow: BuiltTagSeriesRow;
  start: string;
  end: string;
  val: number;
  input: BuildAnnualCycleRowsInput["input"];
}): BuiltTagSeriesRow {
  return {
    ...annualRow,
    start,
    end,
    val,
    display_frame: deriveFrame("quarterly", start, end),
    period_type: "quarterly",
    metric_key: input.metricKey ?? annualRow.metric_key,
    workflow_type: "sec_companyfacts_reconstructed_v1",
  };
}

export function choosePreferredQuarter(
  current: BuiltTagSeriesRow | null,
  candidate: BuiltTagSeriesRow,
): BuiltTagSeriesRow {
  if (!current) {
    return candidate;
  }

  const currentFiled = current.filed ? new Date(current.filed).getTime() : 0;
  const candidateFiled = candidate.filed ? new Date(candidate.filed).getTime() : 0;

  return candidateFiled >= currentFiled ? candidate : current;
}

export function isReasonableQuarterRow(row: BuiltTagSeriesRow): boolean {
  if (!row.start) {
    return false;
  }

  const startMs = new Date(row.start).getTime();
  const endMs = new Date(row.end).getTime();

  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) {
    return false;
  }

  const dayMs = 1000 * 60 * 60 * 24;
  const diffDays = Math.floor((endMs - startMs) / dayMs) + 1;

  return diffDays >= 70 && diffDays <= 125;
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

function isSameDate(
  a: string | Date | null | undefined,
  b: string | Date | null | undefined,
): boolean {
  const aKey = toDateKey(a);
  const bKey = toDateKey(b);

  return aKey !== null && bKey !== null && aKey === bKey;
}
