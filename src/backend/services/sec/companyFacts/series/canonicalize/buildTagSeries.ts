import type { FlatCompanyFactRow } from "@/backend/schemas/sec/companyFacts";
import type {
  BuildTagSeriesInput,
  BuiltTagSeriesRow,
} from "@/backend/services/sec/companyFacts/series/types";

import { buildFlowSeries } from "@/backend/services/sec/companyFacts/series/canonicalize/buildFlowSeries";
import { buildInstantSeries } from "@/backend/services/sec/companyFacts/series/canonicalize/buildInstantSeries";
import { loadFlowPeriodProfile } from "@/backend/services/sec/companyFacts/series/canonicalize/loadFlowPeriodProfile";

export async function buildTagSeries(
  points: FlatCompanyFactRow[],
  input: BuildTagSeriesInput,
): Promise<BuiltTagSeriesRow[]> {
  if (points.length === 0) {
    return [];
  }

  const buildablePoints = points.filter(isBuildablePoint);

  if (buildablePoints.length === 0) {
    return [];
  }

	if (input.factType === "instant") {
		return buildInstantSeries(buildablePoints, input);
	}

	const dedupedPoints = dedupeByPeriodLatest(buildablePoints);
	const profile = await loadFlowPeriodProfile(dedupedPoints[0].cik);
	return buildFlowSeries(dedupedPoints, input, profile);

}

function isBuildablePoint(
  point: FlatCompanyFactRow,
): point is FlatCompanyFactRow & { end: string; val: number } {
  return point.end !== null && point.val !== null;
}

function dedupeByPeriodLatest<
  T extends FlatCompanyFactRow & { end: string; val: number },
>(points: T[]): T[] {
  const byPeriod = new Map<string, T>();

  for (const point of points) {
    const key = [
      toDateKey(point.start),
      toDateKey(point.end),
    ].join("__");

    const existing = byPeriod.get(key);

    if (!existing) {
      byPeriod.set(key, point);
      continue;
    }

    const existingFiled = existing.filed
      ? new Date(existing.filed).getTime()
      : 0;

    const pointFiled = point.filed
      ? new Date(point.filed).getTime()
      : 0;

    if (pointFiled >= existingFiled) {
      byPeriod.set(key, point);
    }
  }

  return Array.from(byPeriod.values());
}

function toDateKey(value: string | Date | null | undefined): string {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
}
