import { db } from "@/backend/config/db";
import type { RevenueGrowthMetrics } from "@/backend/schemas/factors/growth";

type UpsertInput = {
  ticker: string;
  cik: string | null;
  effectiveDate: string | null;
  metrics: RevenueGrowthMetrics;
  sourcePointCount: number;
  sourceWindowEnd: string | null;
  model: "heuristic" | "quantitative" | "modeling";
};

export async function upsert({
  ticker,
  cik,
  effectiveDate,
  metrics,
  sourcePointCount,
  sourceWindowEnd,
  model,
}: UpsertInput): Promise<void> {
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
      $1,  -- ticker
      $2,  -- cik
      $3,  -- factor
      $4,  -- axis
      $5,  -- metric_key
      $6,  -- model
      $7,  -- effective_date
      now(),
      $8,  -- score
      $9::jsonb, -- metrics
      $10, -- source_point_count
      $11, -- source_window_end
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
    "growth",
    "fundamentals_based",
    "revenue",
    model,
    effectiveDate,
    metrics.score,
    JSON.stringify(metrics),
    sourcePointCount,
    sourceWindowEnd,
  ]);
}
