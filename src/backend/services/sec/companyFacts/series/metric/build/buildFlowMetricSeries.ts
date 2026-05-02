// src/backend/services/sec/companyFacts/series/metric/build/buildFlowMetricSeries.ts

import { resolvePeriod } from "@/backend/services/sec/companyFacts/series/period/resolvePeriod";
import type {
  BuildFlowMetricSeriesInput,
  MetricBuildCandidate,
} from "./types";
import { selectBestMetricPeriodRow } from "./selectBestMetricPeriodRow";
import { reconstructQuarterFlows } from "@/backend/services/sec/companyFacts/series/metric/build/reconstructQuarterFlows";
import { mergeOtherFlowsToQuarter } from "@/backend/services/sec/companyFacts/series/metric/build/mergeOtherFlowsToQuarter";
import { toMetricBuildCandidate } from "@/backend/services/sec/companyFacts/series/metric/build/candidateUtils";
import { mergeSegmentedQuarterFlows } from "@/backend/services/sec/companyFacts/series/metric/build/mergeSegmentedQuarterFlows";
import { deriveAnnualFromCompleteQuarters } from "@/backend/services/sec/companyFacts/series/metric/build/deriveAnnualFromCompleteQuarters";

export function buildFlowMetricSeries(
  input: BuildFlowMetricSeriesInput,
) {
  const { context, rows } = input;
  const { fiscalProfile } = context;

  // 1. resolvePeriod 붙이기
  const candidates: MetricBuildCandidate[] = rows.map((row) =>
    toMetricBuildCandidate({
      row,
      resolvedPeriod: resolvePeriod({
        row,
        fiscalProfile,
		    periodContext: context.periodContext,
      }),
    }),
  );

  // 2. period kind 기준으로 1-pass 분리
  const annualRows: MetricBuildCandidate[] = [];
  const quarterRows: MetricBuildCandidate[] = [];
  const ytdRows: MetricBuildCandidate[] = [];
  const otherRows: MetricBuildCandidate[] = [];

  for (const candidate of candidates) {
    switch (candidate.resolvedPeriod.kind) {
      case "annual":
        annualRows.push(candidate);
        break;
      case "quarter":
        quarterRows.push(candidate);
        break;
      case "ytd":
        ytdRows.push(candidate);
        break;
      case "other":
        otherRows.push(candidate);
        break;
      default:
        break;
    }
  }

  // 3. annual은 fiscal year별 1개 선택
  const annualGroups = groupByFiscalYear(annualRows);
  const bestAnnuals = Object.values(annualGroups)
    .map((group) => selectBestMetricPeriodRow({ candidates: group }))
    .filter((value): value is MetricBuildCandidate => value !== null);

	// 4. quarter 재구성 + 선택
	const reconstructedQuarterRows = reconstructQuarterFlows({
		candidates,
    fiscalProfile,
    metricSignProfiles: context.metricSignProfiles,
    periodContext: context.periodContext,
    annualRows,
	});

	const mergedSegmentQuarterRows = mergeSegmentedQuarterFlows({
		candidates,
    periodContext: context.periodContext,
	});

	const mergedOtherQuarterRows = mergeOtherFlowsToQuarter({
		candidates,
		fiscalProfile,
    periodContext: context.periodContext,
	});

	const allQuarterRows = [
		...quarterRows,
		...mergedSegmentQuarterRows,
		...reconstructedQuarterRows,
		...mergedOtherQuarterRows,
	];

	const quarterGroups = groupByFiscalQuarter(allQuarterRows);

	const bestQuarters = Object.values(quarterGroups)
		.map((group) =>
			selectBestMetricPeriodRow({ candidates: group }),
		)
		.filter((v) => v !== null);

  const derivedAnnuals = deriveAnnualFromCompleteQuarters({
    annualRows: bestAnnuals,
    quarterRows: bestQuarters,
  });

  // 5. ytd는 보조
  const bestYtd = selectBestMetricPeriodRow({
    candidates: ytdRows,
  });

  // 6. 결과 조합 (여기서 기존 로직 일부 유지 가능)
  return {
    bestAnnuals: [...bestAnnuals, ...derivedAnnuals],
    bestQuarters,
    bestYtd,
    otherRows,
  };
}

function groupByFiscalYear(rows: MetricBuildCandidate[]) {
  const map: Record<string, MetricBuildCandidate[]> = {};

  for (const row of rows) {
    const fy = row.resolvedPeriod.fiscalYear;
    if (fy == null) continue;

    const key = String(fy);

    if (!map[key]) {
      map[key] = [];
    }

    map[key].push(row);
  }

  return map;
}

function groupByFiscalQuarter(rows: MetricBuildCandidate[]) {
  const map: Record<string, MetricBuildCandidate[]> = {};

  for (const row of rows) {
    const fy = row.resolvedPeriod.fiscalYear;
    const fq = row.resolvedPeriod.fiscalQuarter;

    if (fy == null || fq == null) continue;

    const key = `${fy}-${fq}`;

    if (!map[key]) {
      map[key] = [];
    }

    map[key].push(row);
  }

  return map;
}
