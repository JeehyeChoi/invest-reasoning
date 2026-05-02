import type { FactorKey } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { SecMetricKey } from "@/shared/sec/metrics";

export type FactorBlueprintAxis = {
  metricKeys: SecMetricKey[];
  primaryMetricKey: SecMetricKey | null;
  metricProfiles?: Partial<Record<SecMetricKey, FactorBlueprintMetricProfile>>;
};

export type FactorBlueprintMetricProfile = {
  signProfile?: boolean;
};

export type FactorBlueprintMap = Partial<{
  [factor in FactorKey]: Record<FactorAxisKey, FactorBlueprintAxis>;
}>;

export const FACTOR_BLUEPRINTS: FactorBlueprintMap = {
  capex_cycle: {
    fundamentals_based: {
      metricKeys: [
        "capex_cash",
        "capex_incurred",
        "operating_cash_flow",
        "investing_cash_flow",
      ],
      primaryMetricKey: "capex_cash",
      metricProfiles: {
        capex_cash: {
          signProfile: true,
        },
        capex_incurred: {
          signProfile: true,
        },
        investing_cash_flow: {
          signProfile: true,
        },
      },
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
  defensive: {
    fundamentals_based: {
      metricKeys: [
        "cash_and_cash_equivalents",
        "operating_cash_flow",
        "revenue",
        "liabilities",
        "long_term_debt",
      ],
      primaryMetricKey: "cash_and_cash_equivalents",
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
  growth: {
    fundamentals_based: {
      metricKeys: [
        "revenue",
        "net_income",
        "operating_income",
        "gross_profit",
        "operating_cash_flow",
        "capex_cash",
        "capex_incurred",
      ],
      primaryMetricKey: "revenue",
      metricProfiles: {
        capex_cash: {
          signProfile: true,
        },
        capex_incurred: {
          signProfile: true,
        },
      },
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
      metricKeys: [
        "dividend_payments",
        "dividends_per_share",
        "operating_cash_flow",
        "net_income",
      ],
      primaryMetricKey: "dividend_payments",
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
      metricKeys: ["gross_profit", "operating_income", "operating_cash_flow"],
      primaryMetricKey: "gross_profit",
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

export function getSecMetricKeysRequiringSignProfile(): SecMetricKey[] {
  const metricKeys = new Set<SecMetricKey>();

  for (const factorBlueprint of Object.values(FACTOR_BLUEPRINTS)) {
    if (!factorBlueprint) continue;

    for (const axisBlueprint of Object.values(factorBlueprint)) {
      for (const [metricKey, profile] of Object.entries(
        axisBlueprint.metricProfiles ?? {},
      )) {
        if (profile?.signProfile === true) {
          metricKeys.add(metricKey as SecMetricKey);
        }
      }
    }
  }

  return [...metricKeys];
}
