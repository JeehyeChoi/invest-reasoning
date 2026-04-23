import { resolve } from "@/backend/services/factors/growth/fundamentals_based/revenue/resolve";
import { compute } from "@/backend/services/factors/growth/fundamentals_based/revenue/compute";
import { upsert } from "@/backend/services/factors/growth/fundamentals_based/revenue/upsert";
import { buildMetricRunner } from "@/backend/workflows/ticker-factor-snapshot/steps/buildMetricRunner";

export const run = buildMetricRunner({
  factor: "growth",
  axis: "fundamentals_based",
  metricKey: "revenue",
  logPrefix: "revenue.run",
  resolve,
  compute,
  upsert,
  getSeriesEnd: (point) => point.end ?? null,
});
