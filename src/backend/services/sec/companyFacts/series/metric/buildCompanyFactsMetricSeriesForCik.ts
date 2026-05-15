// src/backend/services/sec/companyFacts/series/metric/buildCompanyFactsMetricSeriesForCik.ts

import { db } from "@/backend/config/db";
import { loadCompanyFiscalProfile } from "@/backend/services/sec/companyFacts/series/fiscal/loadCompanyFiscalProfile";
import { loadCompanyMetricSignProfiles } from "@/backend/services/sec/companyFacts/series/fiscal/loadCompanyMetricSignProfiles";
import { buildMetricSeriesFromTagGroups } from "@/backend/services/sec/companyFacts/series/metric/build/buildMetricSeriesFromTagGroups";
import { filterRevenueRowsByClassification } from "@/backend/services/sec/companyFacts/series/metric/build/filterRevenueRowsByClassification";
import { buildPeriodResolveContext } from "@/backend/services/sec/companyFacts/series/period/resolveContext";
import type {
  MetricBuildContext,
  BuiltMetricSeriesRow,
  TickerClassificationContext,
} from "@/backend/services/sec/companyFacts/series/metric/build/types";
import {
  upsertCompanyFactMetricSeriesRows,
  type CompanyFactMetricSeriesTargetTable,
} from "@/backend/services/sec/companyFacts/series/metric/upsertCompanyFactMetricSeriesRows";
import { getTagSeriesByCik } from "@/backend/services/sec/companyFacts/series/tag/getTagSeriesByCik";
import type { CompanyFactTagMeta } from "@/backend/services/sec/companyFacts/series/tag/types";
import { COMPANY_FACTS_SERIES_TAG_META } from "@/backend/services/sec/companyFacts/series/tagMeta";

export async function buildCompanyFactsMetricSeriesForCik(input: {
  ticker: string;
  cik: string;
  metricKey?: string;
  tagMetaByTag?: Record<string, CompanyFactTagMeta>;
  targetTable?: CompanyFactMetricSeriesTargetTable;
  workflowType?: string;
}): Promise<void> {
  const { ticker, cik, metricKey: targetMetricKey } = input;
  const tagMetaByTag = input.tagMetaByTag ?? COMPANY_FACTS_SERIES_TAG_META;
  const targetTable = input.targetTable ?? "sec_companyfact_metric_series";

  const tagRows = await getTagSeriesByCik({ cik, metricKey: targetMetricKey });

  const fiscalProfile = await loadCompanyFiscalProfile(cik);
  const metricSignProfiles = await loadCompanyMetricSignProfiles(cik);
	const periodContext = buildPeriodResolveContext(fiscalProfile);
  const classification = await getTickerClassification(ticker);

  const byMetricKey = new Map<
    string,
    {
      rows: Array<(typeof tagRows)[number]>;
    }
  >();

  for (const row of tagRows) {
    const meta = tagMetaByTag[row.tag];

    if (!meta) continue;

    const metricKey = meta.metricKey;

    const enrichedRow = {
      ...row,
      priority: meta.priority ?? row.priority,
    };

    const existing = byMetricKey.get(metricKey);

    if (!existing) {
      byMetricKey.set(metricKey, {
        rows: [enrichedRow],
      });
      continue;
    }

    existing.rows.push(enrichedRow);
  }

  const builtRows: BuiltMetricSeriesRow[] = [];

  for (const [metricKey, group] of byMetricKey.entries()) {
    const context: MetricBuildContext = {
      ticker,
      cik,
      metricKey,
      fiscalProfile,
      metricSignProfiles,
			periodContext,
      classification,
    };

    const rows = buildMetricSeriesFromTagGroups({
      context,
      rows: filterRevenueRowsByClassification({
        rows: group.rows,
        classification,
      }),
    });

    builtRows.push(
      ...rows.map((row) => ({
        ...row,
        workflow_type: input.workflowType ?? row.workflow_type,
      })),
    );
  }

  if (builtRows.length === 0) {
    await replaceMetricSeriesRowsForCik({
      cik,
      metricKey: targetMetricKey,
      rows: builtRows,
      targetTable,
    });
    return;
  }

  await replaceMetricSeriesRowsForCik({
    cik,
    metricKey: targetMetricKey,
    rows: builtRows,
    targetTable,
  });
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

async function replaceMetricSeriesRowsForCik(input: {
  cik: string;
  metricKey?: string;
  rows: BuiltMetricSeriesRow[];
  targetTable: CompanyFactMetricSeriesTargetTable;
}): Promise<void> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    if (input.metricKey) {
      await client.query(
        `
        DELETE FROM ${resolveMetricSeriesTargetTableName(input.targetTable)}
        WHERE cik = $1
          AND metric_key = $2
        `,
        [input.cik, input.metricKey],
      );
    } else {
      await client.query(
        `DELETE FROM ${resolveMetricSeriesTargetTableName(
          input.targetTable,
        )} WHERE cik = $1`,
        [input.cik],
      );
    }

    await upsertCompanyFactMetricSeriesRows(
      input.rows,
      client,
      input.targetTable,
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function resolveMetricSeriesTargetTableName(
  table: CompanyFactMetricSeriesTargetTable,
) {
  switch (table) {
    case "sec_companyfact_metric_series":
      return "public.sec_companyfact_metric_series";
    case "sec_companyfact_metric_series_experiment":
      return "public.sec_companyfact_metric_series_experiment";
  }
}
