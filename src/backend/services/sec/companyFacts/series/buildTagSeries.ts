import type { FlatCompanyFactRow } from "@/backend/schemas/sec/companyFacts";
import type {
  BuildTagSeriesInput,
  BuiltTagSeriesRow,
  CompanyFactPeriodType,
  CompanyFactType,
} from "@/backend/services/sec/companyFacts/series/types";

import {
  classifyRawFlowPeriodType,
  deriveFrame,
  type RawFlowPeriodType,
} from "@/backend/services/sec/companyFacts/series/seriesPeriod";

export function buildTagSeries(
  points: FlatCompanyFactRow[],
  input: BuildTagSeriesInput,
): BuiltTagSeriesRow[] {
  if (points.length === 0) {
    return [];
  }

  const buildablePoints = points.filter(isBuildablePoint);

  if (input.factType === "instant") {
    return buildInstantSeries(buildablePoints, input);
  }

  return buildFlowSeries(buildablePoints, input);
}

function buildFlowSeries(
  points: Array<FlatCompanyFactRow & { end: string; val: number }>,
  input: BuildTagSeriesInput,
): BuiltTagSeriesRow[] {
  const quarterlyCandidates = new Map<string, BuiltTagSeriesRow>();
  const annualCandidates = new Map<string, BuiltTagSeriesRow>();
  const cumulativeByCycle = new Map<string, Map<RawFlowPeriodType, BuiltTagSeriesRow>>();

  for (const point of points) {
    const rawPeriodType = classifyRawFlowPeriodType(point.start, point.end);
    if (rawPeriodType === "other") {
      continue;
    }

    const candidateBase = buildBaseRow(point, input);

    if (rawPeriodType === "3m") {
      const quarterlyRow: BuiltTagSeriesRow = {
        ...candidateBase,
        display_frame: deriveFrame("quarterly", point.start, point.end),
        period_type: "quarterly",
      };

      upsertLatestByKey(
        quarterlyCandidates,
        buildSeriesKey(quarterlyRow),
        quarterlyRow,
      );
    }

    if (rawPeriodType === "12m") {
      const annualRow: BuiltTagSeriesRow = {
        ...candidateBase,
        display_frame: deriveFrame("annual", point.start, point.end),
        period_type: "annual",
      };

      upsertLatestByKey(
        annualCandidates,
        buildSeriesKey(annualRow),
        annualRow,
      );
    }

    if (rawPeriodType === "6m" || rawPeriodType === "9m" || rawPeriodType === "12m") {
      const cycleKey = buildCumulativeCycleKey(candidateBase);
      const existingCycle =
        cumulativeByCycle.get(cycleKey) ??
        new Map<RawFlowPeriodType, BuiltTagSeriesRow>();

      const cumulativeCandidate: BuiltTagSeriesRow = {
        ...candidateBase,
        display_frame: null,
        period_type: "other",
      };

      const existingForRawType = existingCycle.get(rawPeriodType);

      if (!existingForRawType) {
        existingCycle.set(rawPeriodType, cumulativeCandidate);
      } else {
        const existingFiled = existingForRawType.filed
          ? new Date(existingForRawType.filed).getTime()
          : 0;
        const currentFiled = cumulativeCandidate.filed
          ? new Date(cumulativeCandidate.filed).getTime()
          : 0;

        if (currentFiled >= existingFiled) {
          existingCycle.set(rawPeriodType, cumulativeCandidate);
        }
      }

      cumulativeByCycle.set(cycleKey, existingCycle);
    }
  }

  for (const cycleRows of cumulativeByCycle.values()) {
    const reconstructedRows = reconstructQuarterliesFromCycle(cycleRows, input);

    for (const reconstructedRow of reconstructedRows) {
      upsertLatestByKey(
        quarterlyCandidates,
        buildSeriesKey(reconstructedRow),
        reconstructedRow,
      );
    }
  }

  return [
    ...quarterlyCandidates.values(),
    ...annualCandidates.values(),
  ].sort((a, b) => {
    const aEnd = new Date(a.end).getTime();
    const bEnd = new Date(b.end).getTime();

    if (aEnd !== bEnd) {
      return aEnd - bEnd;
    }

    const aFiled = a.filed ? new Date(a.filed).getTime() : 0;
    const bFiled = b.filed ? new Date(b.filed).getTime() : 0;

    return aFiled - bFiled;
  });
}

function buildInstantSeries(
  points: Array<FlatCompanyFactRow & { end: string; val: number }>,
  input: BuildTagSeriesInput,
): BuiltTagSeriesRow[] {
  const deduped = new Map<string, BuiltTagSeriesRow>();

  for (const point of points) {
    const candidate: BuiltTagSeriesRow = {
      ...buildBaseRow(point, input),
      display_frame: null,
      period_type: "instant",
    };

    upsertLatestByKey(deduped, buildSeriesKey(candidate), candidate);
  }

  return Array.from(deduped.values()).sort((a, b) => {
    const aEnd = new Date(a.end).getTime();
    const bEnd = new Date(b.end).getTime();
    return aEnd - bEnd;
  });
}

function reconstructQuarterliesFromCycle(
  cycleRows: Map<RawFlowPeriodType, BuiltTagSeriesRow>,
  input: BuildTagSeriesInput,
): BuiltTagSeriesRow[] {
  const reconstructed: BuiltTagSeriesRow[] = [];

  const row6m = cycleRows.get("6m");
  const row9m = cycleRows.get("9m");
  const row12m = cycleRows.get("12m");

  // Q2 = 6m - Q1 (only if direct Q1 is missing from final candidates this will still be added;
  // practically most Q1s are direct 3m, so we skip Q2 reconstruction here unless you later add 3m cumulative storage)
  // For now focus on Q4 which is the main missing case.

  if (row12m && row9m) {
    const q4Val = row12m.val - row9m.val;

    if (Number.isFinite(q4Val)) {
      reconstructed.push({
        ...row12m,
        start: row9m.end,
        val: q4Val,
        display_frame: deriveFrame(
          "quarterly",
          row9m.end,
          row12m.end,
        ),
        period_type: "quarterly",
        metric_key: input.metricKey ?? row12m.metric_key,
      });
    }
  }

  return reconstructed;
}

function buildBaseRow(
  point: FlatCompanyFactRow & { end: string; val: number },
  input: BuildTagSeriesInput,
): Omit<BuiltTagSeriesRow, "display_frame" | "period_type"> {
  if (!input.metricKey) {
    throw new Error(
      `buildTagSeries missing metricKey for ticker=${input.ticker}`,
    );
  }

  return {
    cik: point.cik,
    ticker: input.ticker,
    metric_key: input.metricKey,
    fact_type: input.factType,
    unit: point.unit,
    val: point.val,
    start: point.start,
    end: point.end,
    filed: point.filed,
    accn: point.accn,
    fy: point.fy,
    fp: point.fp,
    form: point.form,
    workflow_type: point.workflow_type,
  };
}

function buildCumulativeCycleKey(
  row: Omit<BuiltTagSeriesRow, "display_frame" | "period_type">,
): string {
  return [
    row.cik,
    row.metric_key,
    row.start ?? "",
  ].join("__");
}

function buildSeriesKey(row: BuiltTagSeriesRow): string {
  if (
    (row.period_type === "quarterly" || row.period_type === "annual") &&
    row.display_frame
  ) {
    return [
      row.cik,
      row.metric_key,
      row.period_type,
      row.display_frame,
    ].join("__");
  }

  return [
    row.cik,
    row.metric_key,
    row.start ?? "",
    row.end,
    row.period_type,
  ].join("__");
}

function upsertLatestByKey(
  map: Map<string, BuiltTagSeriesRow>,
  key: string,
  candidate: BuiltTagSeriesRow,
) {
  const existing = map.get(key);

  if (!existing) {
    map.set(key, candidate);
    return;
  }

  const existingFiled = existing.filed ? new Date(existing.filed).getTime() : 0;
  const currentFiled = candidate.filed ? new Date(candidate.filed).getTime() : 0;

  if (currentFiled >= existingFiled) {
    map.set(key, candidate);
  }
}

function isBuildablePoint(
  point: FlatCompanyFactRow,
): point is FlatCompanyFactRow & { end: string; val: number } {
  return point.end !== null && point.val !== null;
}

// compatibility export if still referenced elsewhere
export function classifyPeriodType(
  factType: CompanyFactType,
  start: string | Date | null,
  end: string | Date | null,
): CompanyFactPeriodType {
  if (factType === "instant") {
    return "instant";
  }

  const raw = classifyRawFlowPeriodType(start, end);

  if (raw === "12m") {
    return "annual";
  }

  if (raw === "3m") {
    return "quarterly";
  }

  return "other";
}
