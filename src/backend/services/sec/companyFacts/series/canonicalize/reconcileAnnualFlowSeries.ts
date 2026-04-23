import type { FlatCompanyFactRow } from "@/backend/schemas/sec/companyFacts";
import type {
  BuildTagSeriesInput,
  BuiltTagSeriesRow,
} from "@/backend/services/sec/companyFacts/series/types";
import type { FlowPeriodProfile } from "@/backend/services/sec/companyFacts/series/canonicalize/flowPeriod";

import { debugSeries } from "@/backend/services/sec/companyFacts/series/canonicalize/debug";
import {
  buildSeriesKey,
  sortSeriesRows,
  upsertLatestByKey,
} from "@/backend/services/sec/companyFacts/series/canonicalize/selectSeriesRow";

import {
  collectAnnualCycleAnchors,
  isRawPointWithinAnnualWindow,
} from "@/backend/services/sec/companyFacts/series/canonicalize/annualCycleAnchors";
import { buildAnnualCycleRows } from "@/backend/services/sec/companyFacts/series/canonicalize/annualCycleReconstruction";
import {
  summarizeRawPoint,
  summarizeSeriesRow,
} from "@/backend/services/sec/companyFacts/series/canonicalize/annualCycleDebug";

export function reconcileAnnualFlowSeries(
  points: Array<FlatCompanyFactRow & { end: string; val: number }>,
  annualRows: BuiltTagSeriesRow[],
  input: BuildTagSeriesInput,
  profile?: FlowPeriodProfile | null,
): BuiltTagSeriesRow[] {
  const reconciled = new Map<string, BuiltTagSeriesRow>();

  for (const annualRow of annualRows) {
    const rowsInWindow = points.filter((point) =>
      isRawPointWithinAnnualWindow(point, annualRow),
    );

    debugSeries(input, "annual:start", {
      annual: summarizeSeriesRow(annualRow),
      rowsInWindow: rowsInWindow.map((point) => summarizeRawPoint(point, profile)),
    });

    const {
      directQuarterlies,
      cumulative6m,
      cumulative9m,
      trailing6m,
    } = collectAnnualCycleAnchors(
      rowsInWindow,
      annualRow,
      input,
      profile,
    );

    const cycleRows = buildAnnualCycleRows({
      annualRow,
      directQuarterlies,
      cumulative6m,
      cumulative9m,
      trailing6m,
      input,
    });

    for (const row of cycleRows) {
      upsertLatestByKey(
        reconciled,
        buildSeriesKey(row),
        row,
      );
    }

    debugSeries(input, "annual:cycle-rows", {
      annual: summarizeSeriesRow(annualRow),
      cycleRows: cycleRows.map(summarizeSeriesRow),
    });

  }

  return sortSeriesRows(Array.from(reconciled.values()));
}
