// src/backend/services/sec/companyFacts/series/metric/build/buildMetricSeriesFromTagGroups.ts

import { buildFlowMetricSeries } from "@/backend/services/sec/companyFacts/series/metric/build/buildFlowMetricSeries";
import { buildInstantMetricSeries } from "@/backend/services/sec/companyFacts/series/metric/build/buildInstantMetricSeries";
import type {
  BuiltMetricSeriesRow,
  MetricBuildCandidate,
  MetricBuildContext,
  MetricBuildSourceRow,
} from "@/backend/services/sec/companyFacts/series/metric/build/types";

export function buildMetricSeriesFromTagGroups(input: {
  context: MetricBuildContext;
  rows: MetricBuildSourceRow[];
}): BuiltMetricSeriesRow[] {
  const { context, rows } = input;

  const flowRows = rows.filter((row) =>
    row.fact_type === "flow" ||
    row.fact_type === "per_share" ||
    row.fact_type === "share_count"
  );
  const instantRows = rows.filter((row) => row.fact_type === "instant");

  const flowResult = buildFlowMetricSeries({
    context,
    rows: flowRows,
  });

  const instantResult = buildInstantMetricSeries({
    context,
    rows: instantRows,
  });

  const candidates = [
    ...flowResult.bestAnnuals,
    ...flowResult.bestQuarters,
    //...flowResult.otherRows,
    ...instantResult,
  ];

  return candidates.map((candidate) =>
    toBuiltMetricSeriesRow(candidate, context),
  );
}

function toBuiltMetricSeriesRow(
  candidate: MetricBuildCandidate,
  context: MetricBuildContext,
): BuiltMetricSeriesRow {
  return {
    cik: context.cik,
    ticker: context.ticker,
    metric_key: context.metricKey,
    source_tag: candidate.tag,
    fact_type: candidate.fact_type,
    unit: candidate.unit,
    val: Number(candidate.val),

    start: candidate.start,
    end: candidate.end,
    duration_days: candidate.duration_days,

    filed: candidate.filed,
    accn: candidate.accn,
    fy: candidate.fy,
    fp: candidate.fp,
    form: candidate.form,
    frame: candidate.frame,

    fiscal_year: candidate.resolvedPeriod.fiscalYear,
    fiscal_quarter: candidate.resolvedPeriod.fiscalQuarter,
    period_type: candidate.resolvedPeriod.kind,
    build_source_kind: candidate.buildSourceKind,

    workflow_type: candidate.workflow_type ?? null,
  };
}
