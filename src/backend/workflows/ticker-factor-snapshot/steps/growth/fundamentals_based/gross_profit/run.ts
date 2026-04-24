import { resolve } from "@/backend/services/factors/growth/fundamentals_based/gross_profit/resolve";
import { compute } from "@/backend/services/factors/growth/fundamentals_based/gross_profit/compute";
import { upsert } from "@/backend/services/factors/growth/fundamentals_based/gross_profit/upsert";
import { buildMetricRunner } from "@/backend/workflows/ticker-factor-snapshot/steps/buildMetricRunner";

export const run = buildMetricRunner({
  factor: "growth",
  axis: "fundamentals_based",
  metricKey: "gross_profit",
  logPrefix: "gross_profit.run",
  resolve,
  compute,
  upsert,
  getSeriesEnd: (point) => point.end ?? null,
});
