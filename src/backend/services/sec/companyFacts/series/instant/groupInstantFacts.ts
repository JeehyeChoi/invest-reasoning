import type { InstantMetricCandidate } from "@/backend/services/sec/companyFacts/series/instant/types";
import { requireDateKey } from "@/backend/services/sec/companyFacts/series/utils/dateKey";

export function groupInstantCandidatesByUnitAndEnd(
  candidates: InstantMetricCandidate[],
): Record<string, InstantMetricCandidate[]> {
  const map: Record<string, InstantMetricCandidate[]> = {};

  for (const candidate of candidates) {
    const key = `${candidate.unit}|${requireDateKey(candidate.end)}`;

    if (!map[key]) {
      map[key] = [];
    }

    map[key].push(candidate);
  }

  return map;
}
