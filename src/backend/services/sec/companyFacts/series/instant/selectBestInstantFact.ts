import type { InstantMetricCandidate } from "@/backend/services/sec/companyFacts/series/instant/types";
import { selectBestMetricPeriodRow } from "@/backend/services/sec/companyFacts/series/metric/build/selectBestMetricPeriodRow";

export function selectBestInstantFact(input: {
  candidates: InstantMetricCandidate[];
}): InstantMetricCandidate | null {
  return selectBestMetricPeriodRow(input);
}
