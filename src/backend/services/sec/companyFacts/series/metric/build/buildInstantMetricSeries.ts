// src/backend/services/sec/companyFacts/series/metric/build/buildInstantMetricSeries.ts

import { groupInstantCandidatesByUnitAndEnd } from "@/backend/services/sec/companyFacts/series/instant/groupInstantFacts";
import { resolveInstantPeriod } from "@/backend/services/sec/companyFacts/series/instant/resolveInstantPeriod";
import { selectBestInstantFact } from "@/backend/services/sec/companyFacts/series/instant/selectBestInstantFact";
import type {
  BuildInstantMetricSeriesInput,
  MetricBuildCandidate,
} from "@/backend/services/sec/companyFacts/series/metric/build/types";
import { toMetricBuildCandidate } from "@/backend/services/sec/companyFacts/series/metric/build/candidateUtils";

export function buildInstantMetricSeries(
  input: BuildInstantMetricSeriesInput,
): MetricBuildCandidate[] {
  const candidates = input.rows.map((row) =>
    toMetricBuildCandidate({
      row,
      resolvedPeriod: resolveInstantPeriod(row),
      buildSourceKind: "raw_direct",
    }),
  );

  return Object.values(groupInstantCandidatesByUnitAndEnd(candidates))
    .map((group) => selectBestInstantFact({ candidates: group }))
    .filter((value): value is MetricBuildCandidate => value !== null);
}
