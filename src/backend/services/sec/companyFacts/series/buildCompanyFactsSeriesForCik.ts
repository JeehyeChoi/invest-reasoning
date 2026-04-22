import { getTagFactsByCik } from "@/backend/services/sec/companyFacts/series/getTagFactsByCik";
import { buildTagSeries } from "@/backend/services/sec/companyFacts/series/buildTagSeries";
import { COMPANY_FACTS_SERIES_TAG_META } from "@/backend/services/sec/companyFacts/series/tagMeta";
import { upsertCompanyFactSeriesRows } from "@/backend/services/sec/companyFacts/series/upsertCompanyFactSeriesRows";

import type { FlatCompanyFactRow } from "@/backend/schemas/sec/companyFacts";

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

  for (const [tag, points] of groupedByTag.entries()) {
    const meta = COMPANY_FACTS_SERIES_TAG_META[tag];

    if (!meta) {
      continue;
    }

    const builtRows = buildTagSeries(points, {
      ticker,
      metricKey: meta.metricKey,
      factType: meta.factType,
    });

    if (builtRows.length === 0) {
      continue;
    }

    await upsertCompanyFactSeriesRows(builtRows);
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
