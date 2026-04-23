import type { FlatCompanyFactRow } from "@/backend/schemas/sec/companyFacts";
import type {
  BuildTagSeriesInput,
  BuiltTagSeriesRow,
} from "@/backend/services/sec/companyFacts/series/types";
import {
  classifyRawFlowPeriodType,
  deriveFrame,
} from "@/backend/services/sec/companyFacts/series/canonicalize/flowPeriod";
import { reconcileAnnualFlowSeries } from "@/backend/services/sec/companyFacts/series/canonicalize/reconcileAnnualFlowSeries";
import {
  buildBaseRow,
  buildSeriesKey,
  sortSeriesRows,
  upsertLatestByKey,
} from "@/backend/services/sec/companyFacts/series/canonicalize/selectSeriesRow";
import type { FlowPeriodProfile } from "@/backend/services/sec/companyFacts/series/canonicalize/flowPeriod";
import { shiftDateString } from "@/backend/services/sec/companyFacts/series/canonicalize/dateWindows";
import { normalizeQuarterliesByContinuity } from "@/backend/services/sec/companyFacts/series/canonicalize/quarterContinuity";

export function buildFlowSeries(
  points: Array<FlatCompanyFactRow & { end: string; val: number }>,
  input: BuildTagSeriesInput,
  profile?: FlowPeriodProfile | null,
): BuiltTagSeriesRow[] {
  const quarterlyCandidates = new Map<string, BuiltTagSeriesRow>();
  const annualCandidates = new Map<string, BuiltTagSeriesRow>();

  for (const point of points) {
		const rawType = classifyRawFlowPeriodType(point.start, point.end, profile);
    if (rawType === "other") {
      continue;
    }

    const base = buildBaseRow(point, input);

    if (rawType === "3m") {
      const quarterlyRow: BuiltTagSeriesRow = {
        ...base,
        display_frame: deriveFrame("quarterly", point.start, point.end),
        period_type: "quarterly",
      };

      upsertLatestByKey(
        quarterlyCandidates,
        buildSeriesKey(quarterlyRow),
        quarterlyRow,
      );
    }

    if (rawType === "12m") {
      const annualRow: BuiltTagSeriesRow = {
        ...base,
        display_frame: deriveFrame("annual", point.start, point.end),
        period_type: "annual",
      };

      upsertLatestByKey(
        annualCandidates,
        buildSeriesKey(annualRow),
        annualRow,
      );
    }
  }

  if (annualCandidates.size > 0) {
    const reconciledQuarterlies = reconcileAnnualFlowSeries(
      points,
      Array.from(annualCandidates.values()),
      input,
			profile,
    );

    for (const row of reconciledQuarterlies) {
      upsertLatestByKey(
        quarterlyCandidates,
        buildSeriesKey(row),
        row,
      );
    }
  }

	const quarterlyRows = normalizeQuarterliesByContinuity(
		Array.from(quarterlyCandidates.values()),
		profile,
	);

	const annualRows = Array.from(annualCandidates.values());

	return sortSeriesRows([
		...quarterlyRows,
		...annualRows,
	]);

}


