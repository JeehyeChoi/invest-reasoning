import { resolve } from "@/backend/services/factors/growth/fundamentals_based/operating_cash_flow/resolve";
import { compute } from "@/backend/services/factors/growth/fundamentals_based/operating_cash_flow/compute";
import { upsert } from "@/backend/services/factors/growth/fundamentals_based/operating_cash_flow/upsert";
import { buildMetricRunner } from "@/backend/workflows/ticker-factor-snapshot/steps/buildMetricRunner";

export const run = buildMetricRunner({
  factor: "growth",
  axis: "fundamentals_based",
  metricKey: "operating_cash_flow",
  logPrefix: "operating_cash_flow.run",
  resolve,
  compute,
  upsert,
  getSeriesEnd: (point) => point.end ?? null,
});
