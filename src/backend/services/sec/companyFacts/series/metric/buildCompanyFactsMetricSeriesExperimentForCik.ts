import { db } from "@/backend/config/db";
import { buildCompanyFactsMetricSeriesForCik } from "@/backend/services/sec/companyFacts/series/metric/buildCompanyFactsMetricSeriesForCik";
import { buildCompanyFactsTagSeriesForCik } from "@/backend/services/sec/companyFacts/series/tag/buildCompanyFactsTagSeriesForCik";
import type { CompanyFactTagMeta } from "@/backend/services/sec/companyFacts/series/tag/types";
import {
  COMPANY_FACTS_SERIES_TAG_META_EXPERMENT,
  TAG_META_EXPERMENT_WORKFLOW_TYPE,
  isExperimentTagAllowedForSector,
} from "@/backend/services/sec/companyFacts/series/tagMetaExperment";

type TickerClassificationContext = {
  sector: string | null;
  industry: string | null;
};

export async function buildCompanyFactsMetricSeriesExperimentForCik(input: {
  ticker: string;
  cik: string;
  tags?: string[];
}): Promise<{ experimentalTagCount: number }> {
  const classification = await getTickerClassification(input.ticker);
  const tagMetaByTag = buildExperimentTagMetaByTag({
    classification,
    tags: input.tags,
  });
  const experimentalTagCount = Object.keys(tagMetaByTag).length;

  await buildCompanyFactsTagSeriesForCik({
    ticker: input.ticker,
    cik: input.cik,
    tagMetaByTag,
    workflowType: TAG_META_EXPERMENT_WORKFLOW_TYPE,
  });

  await buildCompanyFactsMetricSeriesForCik({
    ticker: input.ticker,
    cik: input.cik,
    tagMetaByTag,
    targetTable: "sec_companyfact_metric_series_experiment",
    workflowType: TAG_META_EXPERMENT_WORKFLOW_TYPE,
  });

  return { experimentalTagCount };
}

function buildExperimentTagMetaByTag(input: {
  classification: TickerClassificationContext | null;
  tags?: string[];
}): Record<string, CompanyFactTagMeta> {
  const result: Record<string, CompanyFactTagMeta> = {};
  const allowedTags = input.tags?.length ? new Set(input.tags) : null;

  for (const [tag, meta] of Object.entries(
    COMPANY_FACTS_SERIES_TAG_META_EXPERMENT,
  )) {
    if (allowedTags && !allowedTags.has(tag)) {
      continue;
    }

    if (
      !isExperimentTagAllowedForSector({
        meta,
        sector: input.classification?.sector,
      })
    ) {
      continue;
    }

    result[tag] = {
      metricKey: meta.metricKey,
      factType: meta.factType,
      priority: meta.priority,
    };
  }

  return result;
}

async function getTickerClassification(
  ticker: string,
): Promise<TickerClassificationContext | null> {
  const result = await db.query<TickerClassificationContext>(
    `
    SELECT sector, industry
    FROM public.ticker_company_classifications
    WHERE ticker = $1
    `,
    [ticker],
  );

  return result.rows[0] ?? null;
}
