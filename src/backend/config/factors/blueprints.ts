import type { FactorKey, FactorScoreAxisKey } from "@/backend/schemas/factor";
import type { SecMetricKey } from "@/backend/schemas/sec/metrics";

export type FactorBlueprint = {
  factor: FactorKey;
  axis: FactorScoreAxisKey;
  metricKeys: SecMetricKey[];
  primaryMetricKey?: SecMetricKey;
};

export const FACTOR_BLUEPRINTS: FactorBlueprint[] = [
  {
    factor: "growth",
    axis: "fundamentals_based",
    metricKeys: [
      "revenue",
      "net_income",
      "operating_income",
      "operating_cash_flow",
    ],
    primaryMetricKey: "revenue",
  },
  {
    factor: "income",
    axis: "fundamentals_based",
    metricKeys: [
      "dividends_per_share",
      "dividend_payments",
    ],
    primaryMetricKey: "dividends_per_share",
  },
  {
    factor: "quality",
    axis: "fundamentals_based",
    metricKeys: [
      "gross_profit",
      "operating_income",
      "stockholders_equity",
      "liabilities",
    ],
    primaryMetricKey: "operating_income",
  },
];
