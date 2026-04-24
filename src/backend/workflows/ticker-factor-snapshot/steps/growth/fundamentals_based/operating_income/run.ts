import { resolve } from "@/backend/services/factors/growth/fundamentals_based/operating_income/resolve";
import { compute } from "@/backend/services/factors/growth/fundamentals_based/operating_income/compute";
import { upsert } from "@/backend/services/factors/growth/fundamentals_based/operating_income/upsert";
import { buildMetricRunner } from "@/backend/workflows/ticker-factor-snapshot/steps/buildMetricRunner";

export const run = buildMetricRunner({
  factor: "growth",
  axis: "fundamentals_based",
  metricKey: "operating_income",
  logPrefix: "operating_income.run",
  resolve,
  compute,
  upsert,
  getSeriesEnd: (point) => point.end ?? null,
});
