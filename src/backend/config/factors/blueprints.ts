import type { FactorKey, FactorMetricRole } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { SecMetricKey } from "@/shared/sec/metrics";

export type FactorBlueprintAxis = {
  metricKeys: SecMetricKey[];
  primaryMetricKey: SecMetricKey | null;
  metricProfiles?: Partial<Record<SecMetricKey, FactorBlueprintMetricProfile>>;
};

export type FactorBlueprintMetricProfile = {
  role?: FactorMetricRole;
  signProfile?: FactorMetricSignProfileConfig;
};

export const FACTOR_METRIC_SIGN_PROFILE_APPLICATIONS = [
  "quarter_reconstruction_guard",
  "feature_value_normalization",
] as const;

export type FactorMetricSignProfileApplication =
  (typeof FACTOR_METRIC_SIGN_PROFILE_APPLICATIONS)[number];

export const FACTOR_METRIC_SIGN_PROFILE_OBSERVATION_SCOPES = [
  "raw_direct_10k_10q",
] as const;

export type FactorMetricSignProfileObservationScope =
  (typeof FACTOR_METRIC_SIGN_PROFILE_OBSERVATION_SCOPES)[number];

export type FactorMetricSignProfileConfig = {
  enabled: true;
  observationScope: FactorMetricSignProfileObservationScope;
  applications: FactorMetricSignProfileApplication[];
};

export type FactorBlueprintMap = Partial<{
  [factor in FactorKey]: Record<FactorAxisKey, FactorBlueprintAxis>;
}>;

const EMPTY_FACTOR_AXIS_BLUEPRINT: FactorBlueprintAxis = {
  metricKeys: [],
  primaryMetricKey: null,
};

const EMPTY_FACTOR_BLUEPRINT: Record<FactorAxisKey, FactorBlueprintAxis> = {
  fundamentals_based: EMPTY_FACTOR_AXIS_BLUEPRINT,
  etf_implied: EMPTY_FACTOR_AXIS_BLUEPRINT,
  narrative_implied: EMPTY_FACTOR_AXIS_BLUEPRINT,
};

export const FACTOR_BLUEPRINTS: FactorBlueprintMap = {
  consumer_strength: EMPTY_FACTOR_BLUEPRINT,
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
          role: "core",
          signProfile: {
            enabled: true,
            observationScope: "raw_direct_10k_10q",
            applications: ["quarter_reconstruction_guard"],
          },
        },
        capex_incurred: {
          role: "supporting",
        },
        operating_cash_flow: {
          role: "context",
        },
        investing_cash_flow: {
          role: "context",
          signProfile: {
            enabled: true,
            observationScope: "raw_direct_10k_10q",
            applications: ["feature_value_normalization"],
          },
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
  rate_sensitive: EMPTY_FACTOR_BLUEPRINT,
  energy_linked: {
    fundamentals_based: {
      metricKeys: [
        "energy_revenue",
        "energy_exploration_expense",
        "oil_gas_capitalized_costs",
        "energy_inventory",
        "energy_input_cost",
      ],
      primaryMetricKey: "energy_revenue",
      metricProfiles: {
        energy_revenue: {
          role: "core",
        },
        energy_exploration_expense: {
          role: "core",
        },
        oil_gas_capitalized_costs: {
          role: "core",
        },
        energy_inventory: {
          role: "supporting",
        },
        energy_input_cost: {
          role: "context",
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
  china_exposure: EMPTY_FACTOR_BLUEPRINT,
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
      metricProfiles: {
        cash_and_cash_equivalents: {
          role: "core",
        },
        operating_cash_flow: {
          role: "supporting",
        },
        revenue: {
          role: "supporting",
        },
        liabilities: {
          role: "core",
        },
        long_term_debt: {
          role: "core",
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
  duration_sensitive: EMPTY_FACTOR_BLUEPRINT,
  liquidity_sensitive: EMPTY_FACTOR_BLUEPRINT,
  inflation_hedge: EMPTY_FACTOR_BLUEPRINT,
  commodity_linked: EMPTY_FACTOR_BLUEPRINT,
  reshoring_defense: EMPTY_FACTOR_BLUEPRINT,
  growth: {
    fundamentals_based: {
      metricKeys: [
        "revenue",
        "net_income",
        "operating_income",
        "gross_profit",
        "operating_cash_flow",
      ],
      primaryMetricKey: "revenue",
      metricProfiles: {
        revenue: {
          role: "core",
        },
        net_income: {
          role: "supporting",
        },
        operating_income: {
          role: "supporting",
        },
        gross_profit: {
          role: "supporting",
        },
        operating_cash_flow: {
          role: "supporting",
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
  value: EMPTY_FACTOR_BLUEPRINT,
  cyclical: EMPTY_FACTOR_BLUEPRINT,
  income: {
    fundamentals_based: {
      metricKeys: [
        "dividend_payments",
        "dividends_per_share",
        "operating_cash_flow",
        "net_income",
      ],
      primaryMetricKey: "dividend_payments",
      metricProfiles: {
        dividend_payments: {
          role: "core",
        },
        dividends_per_share: {
          role: "core",
        },
        operating_cash_flow: {
          role: "supporting",
        },
        net_income: {
          role: "supporting",
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
  size: EMPTY_FACTOR_BLUEPRINT,
  momentum: EMPTY_FACTOR_BLUEPRINT,
  high_beta: EMPTY_FACTOR_BLUEPRINT,
  low_volatility: EMPTY_FACTOR_BLUEPRINT,
  quality: {
    fundamentals_based: {
      metricKeys: ["gross_profit", "operating_income", "operating_cash_flow"],
      primaryMetricKey: "gross_profit",
      metricProfiles: {
        gross_profit: {
          role: "core",
        },
        operating_income: {
          role: "supporting",
        },
        operating_cash_flow: {
          role: "supporting",
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
};

export function getFactorMetricRole(input: {
  factor: FactorKey;
  axis: FactorAxisKey;
  metricKey: SecMetricKey;
}): FactorMetricRole {
  const axisBlueprint = FACTOR_BLUEPRINTS[input.factor]?.[input.axis];
  const explicitRole = axisBlueprint?.metricProfiles?.[input.metricKey]?.role;

  if (explicitRole) return explicitRole;
  if (axisBlueprint?.primaryMetricKey === input.metricKey) return "core";

  return "supporting";
}

export function getSecMetricKeysRequiringSignProfile(): SecMetricKey[] {
  const metricKeys = new Set<SecMetricKey>();

  for (const factorBlueprint of Object.values(FACTOR_BLUEPRINTS)) {
    if (!factorBlueprint) continue;

    for (const axisBlueprint of Object.values(factorBlueprint)) {
      for (const [metricKey, profile] of Object.entries(
        axisBlueprint.metricProfiles ?? {},
      )) {
        if (profile?.signProfile?.enabled === true) {
          metricKeys.add(metricKey as SecMetricKey);
        }
      }
    }
  }

  return [...metricKeys];
}
