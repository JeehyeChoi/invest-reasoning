import { resolve } from "@/backend/services/factors/growth/fundamentals_based/net_income/resolve";
import { compute } from "@/backend/services/factors/growth/fundamentals_based/net_income/compute";
import { upsert } from "@/backend/services/factors/growth/fundamentals_based/net_income/upsert";
import { buildMetricRunner } from "@/backend/workflows/ticker-factor-snapshot/steps/buildMetricRunner";

export const run = buildMetricRunner({
  factor: "growth",
  axis: "fundamentals_based",
  metricKey: "net_income",
  logPrefix: "net_income.run",
  resolve,
  compute,
  upsert,
  getSeriesEnd: (point) => point.end ?? null,
});
