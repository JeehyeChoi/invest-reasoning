import type { FactorKey, FactorScoreAxisKey } from "@/backend/schemas/factor";
import type { SecMetricKey } from "@/backend/schemas/sec/metrics";

export type FactorBlueprintAxis = {
  metricKeys: SecMetricKey[];
  primaryMetricKey: SecMetricKey | null;
};

export type FactorBlueprintMap = Partial<{
  [factor in FactorKey]: {
    fundamentals_based: FactorBlueprintAxis;
    etf_implied: FactorBlueprintAxis;
    narrative_implied: FactorBlueprintAxis;
  };
}>;

export const FACTOR_BLUEPRINTS: FactorBlueprintMap = {
  growth: {
    fundamentals_based: {
      metricKeys: ["revenue", "net_income", "operating_income", "gross_profit", "operating_cash_flow", "capex"],
      primaryMetricKey: "revenue",
    },
    etf_implied: {
      metricKeys: [],
      primaryMetricKey: null,
    },
    narrative_implied: {
      metricKeys: [],
      primaryMetricKey: null,
    },
  },
  income: {
    fundamentals_based: {
      metricKeys: ["dividends_per_share", "dividend_payments"],
      primaryMetricKey: "dividends_per_share",
    },
    etf_implied: {
      metricKeys: [],
      primaryMetricKey: null,
    },
    narrative_implied: {
      metricKeys: [],
      primaryMetricKey: null,
    },
  },
  quality: {
    fundamentals_based: {
      metricKeys: ["gross_profit", "operating_income", "stockholders_equity", "liabilities"],
      primaryMetricKey: "operating_income",
    },
    etf_implied: {
      metricKeys: [],
      primaryMetricKey: null,
    },
    narrative_implied: {
      metricKeys: [],
      primaryMetricKey: null,
    },
  },
};
