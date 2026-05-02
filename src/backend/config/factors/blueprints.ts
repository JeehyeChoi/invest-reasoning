import type { FactorKey, FactorScoreAxisKey } from "@/shared/factors/factors";
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
  [factor in FactorKey]: Record<FactorScoreAxisKey, FactorBlueprintAxis>;
}>;

export const FACTOR_BLUEPRINTS: FactorBlueprintMap = {
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
      metricKeys: [],
      primaryMetricKey: null,
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
      metricKeys: [],
      primaryMetricKey: null,
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
