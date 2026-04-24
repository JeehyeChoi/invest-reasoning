import type { FactorModelFamily } from "@/backend/config/factors/active";
import type { GrowthMetricSignalsExtended } from "@/backend/schemas/factors/growth";
import { upsertMetric } from "@/backend/services/factors/growth/fundamentals_based/upsertMetric";

type UpsertInput = {
  ticker: string;
  cik: string | null;
  effectiveDate: string | null;
  metrics: GrowthMetricSignalsExtended;
  sourcePointCount: number;
  sourceWindowEnd: string | null;
  model: FactorModelFamily;
};

export async function upsert(input: UpsertInput): Promise<void> {
  return upsertMetric({
    ...input,
    factor: "growth",
    axis: "fundamentals_based",
    metricKey: "operating_cash_flow",
  });
}
