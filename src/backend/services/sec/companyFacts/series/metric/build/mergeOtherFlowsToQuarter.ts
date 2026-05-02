import type { CompanyFiscalProfile } from "@/backend/services/sec/companyFacts/series/fiscal/types";
import type { MetricBuildCandidate } from "@/backend/services/sec/companyFacts/series/metric/build/types";
import { resolvePeriod } from "@/backend/services/sec/companyFacts/series/period/resolvePeriod";
import type { PeriodResolveContext } from "@/backend/services/sec/companyFacts/series/period/resolveContext";
import { toUtcDateMs } from "@/backend/services/sec/companyFacts/series/utils/dateKey";

export type MergedOtherQuarterFlow = MetricBuildCandidate & {
  workflow_type: "sec_companyfacts_other_merged_v1";
};

export function mergeOtherFlowsToQuarter(input: {
  candidates: MetricBuildCandidate[];
  fiscalProfile: CompanyFiscalProfile | null;
  periodContext?: PeriodResolveContext;
}): MergedOtherQuarterFlow[] {
  const { candidates, fiscalProfile } = input;

  const others = candidates.filter((c) => c.resolvedPeriod.kind === "other");
  const grouped = groupByKey(others);

  const results: MergedOtherQuarterFlow[] = [];

  for (const group of grouped) {
    const sorted = [...group]
      .filter((row) => row.start && row.end)
      .sort((a, b) => {
        return (toUtcDateMs(a.start) ?? 0) - (toUtcDateMs(b.start) ?? 0);
      });

    const chains = splitIntoContiguousChains(sorted);

    for (const chain of chains) {
      for (let endIndex = 1; endIndex < chain.length; endIndex++) {
        const merged = tryMerge({
          group: chain.slice(0, endIndex + 1),
          fiscalProfile,
          periodContext: input.periodContext,
        });

        if (!merged) continue;

        results.push(merged);
        break;
      }
    }
  }

  return results;
}

function groupByKey(rows: MetricBuildCandidate[]): MetricBuildCandidate[][] {
  const map = new Map<string, MetricBuildCandidate[]>();

  for (const row of rows) {
    const key = `${row.metric_key}|${row.unit}`;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }

  return Array.from(map.values());
}

function isContiguous(
  a: MetricBuildCandidate,
  b: MetricBuildCandidate,
): boolean {
  if (!a.end || !b.start) return false;

  const aEnd = toUtcDateMs(a.end);
  const bStart = toUtcDateMs(b.start);

  if (aEnd == null || bStart == null) return false;

  const oneDay = 24 * 60 * 60 * 1000;

  return Math.abs(bStart - (aEnd + oneDay)) <= oneDay;
}

function splitIntoContiguousChains(
  rows: MetricBuildCandidate[],
): MetricBuildCandidate[][] {
  if (rows.length === 0) return [];

  const chains: MetricBuildCandidate[][] = [];
  let currentChain: MetricBuildCandidate[] = [rows[0]!];

  for (let i = 1; i < rows.length; i++) {
    const previous = currentChain[currentChain.length - 1]!;
    const next = rows[i]!;

    if (isContiguous(previous, next)) {
      currentChain.push(next);
      continue;
    }

    chains.push(currentChain);
    currentChain = [next];
  }

  chains.push(currentChain);
  return chains;
}

function tryMerge(input: {
  group: MetricBuildCandidate[];
  fiscalProfile: CompanyFiscalProfile | null;
  periodContext?: PeriodResolveContext;
}): MergedOtherQuarterFlow | null {
  const { group, fiscalProfile } = input;

  const first = group[0];
  const last = group[group.length - 1];

  if (!first.start || !last.end) return null;

  const durationDays = diffDaysInclusive(first.start, last.end);

  const sum = group.reduce((acc, row) => acc + Number(row.val), 0);
  if (!Number.isFinite(sum)) return null;

  const resolvedPeriod = resolvePeriod({
    row: {
      ...last,
      start: first.start,
      end: last.end,
      duration_days: durationDays,
    },
    fiscalProfile,
	  periodContext: input.periodContext,
  });

  if (resolvedPeriod.kind !== "quarter") {
    return null;
  }

  return {
    ...last,
    val: sum,
    start: first.start,
    end: last.end,
    duration_days: durationDays,
    resolvedPeriod,
    buildSourceKind: "other_merged",
    workflow_type: "sec_companyfacts_other_merged_v1",
  };
}

function diffDaysInclusive(start: Date | string, end: Date | string): number {
  const startMs = toUtcDateMs(start);
  const endMs = toUtcDateMs(end);

  if (startMs == null || endMs == null) return 0;

  return Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
}
