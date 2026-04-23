import { getTagFactsByCik } from "@/backend/services/sec/companyFacts/series/getTagFactsByCik";
import { buildTagSeries } from "@/backend/services/sec/companyFacts/series/canonicalize/buildTagSeries";
import { COMPANY_FACTS_SERIES_TAG_META } from "@/backend/services/sec/companyFacts/series/tagMeta";
import { upsertCompanyFactSeriesRows } from "@/backend/services/sec/companyFacts/series/upsertCompanyFactSeriesRows";
import {
  selectMetricSeriesCandidates,
  type MetricSeriesCandidate,
} from "@/backend/services/sec/companyFacts/series/selectMetricSeriesCandidates";

import type { FlatCompanyFactRow } from "@/backend/schemas/sec/companyFacts";
import type { BuiltTagSeriesRow } from "@/backend/services/sec/companyFacts/series/types";

export async function buildCompanyFactsSeriesForCik(input: {
  ticker: string;
  cik: string;
}) {
  const { ticker, cik } = input;

  const rawFacts = await getTagFactsByCik({
    cik,
    taxonomy: "us-gaap",
  });

  if (rawFacts.length === 0) {
    return;
  }

  const groupedByTag = groupFactsByTag(rawFacts);
  const candidatesByMetricKey = new Map<string, MetricSeriesCandidate[]>();

  for (const [tag, points] of groupedByTag.entries()) {
    const meta = COMPANY_FACTS_SERIES_TAG_META[tag];

    if (!meta) {
      continue;
    }

		const builtRows = await buildTagSeries(points, {
      ticker,
      metricKey: meta.metricKey,
      factType: meta.factType,
    });

    if (builtRows.length === 0) {
      continue;
    }

    const candidates = candidatesByMetricKey.get(meta.metricKey) ?? [];
    candidates.push({
      tag,
      priority: meta.priority ?? 99,
      rows: builtRows,
    });
    candidatesByMetricKey.set(meta.metricKey, candidates);
  }

	for (const [, candidates] of candidatesByMetricKey.entries()) {
		const mergedRows = selectMetricSeriesCandidates(candidates);

		if (mergedRows.length === 0) {
			continue;
		}

		await upsertCompanyFactSeriesRows(mergedRows);
	}

}

function groupFactsByTag(
  points: FlatCompanyFactRow[],
): Map<string, FlatCompanyFactRow[]> {
  const grouped = new Map<string, FlatCompanyFactRow[]>();

  for (const point of points) {
    const current = grouped.get(point.tag) ?? [];
    current.push(point);
    grouped.set(point.tag, current);
  }

  return grouped;
}

function mergeMetricSeriesCandidates(
  candidates: MetricSeriesCandidate[],
): BuiltTagSeriesRow[] {
  if (candidates.length === 0) {
    return [];
  }

  const byPoint = new Map<
    string,
    { priority: number; tag: string; row: BuiltTagSeriesRow }
  >();

  for (const candidate of candidates) {
    for (const row of candidate.rows) {
      const key = buildMetricPointKey(row);
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

function buildMetricPointKey(row: BuiltTagSeriesRow): string {
  return [
    row.metric_key,
    row.period_type,
    row.start ?? "",
    row.end,
  ].join("__");
}
