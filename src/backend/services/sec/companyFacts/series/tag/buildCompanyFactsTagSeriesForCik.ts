import { db } from "@/backend/config/db";
import { getTagFactsByCik } from "@/backend/services/sec/companyFacts/raw/getTagFactsByCik";
import { COMPANY_FACTS_SERIES_TAG_META } from "@/backend/services/sec/companyFacts/series/tagMeta";
import { insertCompanyFactTagSeriesRows } from "@/backend/services/sec/companyFacts/series/tag/insertCompanyFactTagSeriesRows";
import { mapRawFactToTagSeriesRow } from "@/backend/services/sec/companyFacts/series/tag/mapRawFactToTagSeriesRow";

import type { CompanyFactTagMeta } from "@/backend/services/sec/companyFacts/series/tag/types";
import type { CompanyFactTagSeriesRow } from "@/backend/services/sec/companyFacts/series/tag/types";

export async function buildCompanyFactsTagSeriesForCik(input: {
  ticker: string;
  cik: string;
  tagMetaByTag?: Record<string, CompanyFactTagMeta>;
  workflowType?: string;
}) {
  const { ticker, cik } = input;
  const tagMetaByTag = input.tagMetaByTag ?? COMPANY_FACTS_SERIES_TAG_META;

  const rawFacts = await getTagFactsByCik({ cik });

  const rows: CompanyFactTagSeriesRow[] = [];

  for (const point of rawFacts) {
    const tagMeta = tagMetaByTag[point.tag];

    if (!tagMeta) {
      continue;
    }

    const row = mapRawFactToTagSeriesRow({
      point,
      ticker,
      tagMeta,
      workflowType: input.workflowType,
    });

    if (!row) {
      continue;
    }

    rows.push(row);
  }

  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM public.sec_companyfact_tag_series WHERE cik = $1`,
      [cik],
    );
    await insertCompanyFactTagSeriesRows(rows, client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
