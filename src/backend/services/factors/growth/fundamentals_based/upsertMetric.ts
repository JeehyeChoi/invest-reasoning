// src/backend/services/factors/growth/fundamentals_based/upsertMetric.ts

import { db } from "@/backend/config/db";
import type { FactorModelFamily } from "@/backend/config/factors/active";
import type { FactorKey, FactorScoreAxisKey } from "@/backend/schemas/factor";
import type { GrowthMetricSignalsExtended } from "@/backend/schemas/factors/growth";
import type { SecMetricKey } from "@/backend/schemas/sec/metrics";

type UpsertMetricInput = {
  ticker: string;
  cik: string | null;
  factor: FactorKey;
  axis: FactorScoreAxisKey;
  metricKey: SecMetricKey;
  effectiveDate: string | null;
  metrics: GrowthMetricSignalsExtended;
  sourcePointCount: number;
  sourceWindowEnd: string | null;
  model: FactorModelFamily;
};

export async function upsertMetric({
  ticker,
  cik,
  factor,
  axis,
  metricKey,
  effectiveDate,
  metrics,
  sourcePointCount,
  sourceWindowEnd,
  model,
}: UpsertMetricInput): Promise<void> {
  const query = `
    INSERT INTO ticker_factor_metrics (
      ticker,
      cik,
      factor,
      axis,
      metric_key,
      model,
      effective_date,
      computed_at,
      score,
      metrics,
      source_point_count,
      source_window_end,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      now(),
      $8,
      $9::jsonb,
      $10,
      $11,
      now()
    )
    ON CONFLICT (
      ticker,
      factor,
      axis,
      metric_key,
      model,
      effective_date
    )
    DO UPDATE SET
      cik = EXCLUDED.cik,
      score = EXCLUDED.score,
      metrics = EXCLUDED.metrics,
      source_point_count = EXCLUDED.source_point_count,
      source_window_end = EXCLUDED.source_window_end,
      computed_at = now(),
      updated_at = now()
  `;

  await db.query(query, [
    ticker,
    cik,
    factor,
    axis,
    metricKey,
    model,
    effectiveDate,
    metrics.score,
    JSON.stringify(metrics),
    sourcePointCount,
    sourceWindowEnd,
  ]);
}
