import type { BuiltTagSeriesRow } from "@/backend/services/sec/companyFacts/series/types";
import { buildSeriesKey } from "@/backend/services/sec/companyFacts/series/canonicalize/selectSeriesRow";

export type MetricSeriesCandidate = {
  tag: string;
  priority: number;
  rows: BuiltTagSeriesRow[];
};

export function selectMetricSeriesCandidates(
  candidates: MetricSeriesCandidate[],
): BuiltTagSeriesRow[] {
  if (candidates.length === 0) {
    return [];
  }

  const byPoint = new Map<
    string,
    {
      priority: number;
      tag: string;
      row: BuiltTagSeriesRow;
    }
  >();

  for (const candidate of candidates) {
    for (const row of candidate.rows) {
      const key = buildSeriesKey(row);
      const existing = byPoint.get(key);

      if (!existing) {
        byPoint.set(key, {
          priority: candidate.priority,
          tag: candidate.tag,
          row,
        });
        continue;
      }

      if (candidate.priority < existing.priority) {
        byPoint.set(key, {
          priority: candidate.priority,
          tag: candidate.tag,
          row,
        });
        continue;
      }

      if (candidate.priority === existing.priority) {
        const existingFiled = existing.row.filed
          ? new Date(existing.row.filed).getTime()
          : 0;
        const candidateFiled = row.filed
          ? new Date(row.filed).getTime()
          : 0;

        if (candidateFiled >= existingFiled) {
          byPoint.set(key, {
            priority: candidate.priority,
            tag: candidate.tag,
            row,
          });
        }
      }
    }
  }

  return Array.from(byPoint.values())
    .map((entry) => entry.row)
    .sort((a, b) => {
      const aEnd = new Date(a.end).getTime();
      const bEnd = new Date(b.end).getTime();

      if (aEnd !== bEnd) {
        return aEnd - bEnd;
      }

      const aStart = a.start ? new Date(a.start).getTime() : 0;
      const bStart = b.start ? new Date(b.start).getTime() : 0;

      if (aStart !== bStart) {
        return aStart - bStart;
      }

      const aFiled = a.filed ? new Date(a.filed).getTime() : 0;
      const bFiled = b.filed ? new Date(b.filed).getTime() : 0;

      return aFiled - bFiled;
    });
}
