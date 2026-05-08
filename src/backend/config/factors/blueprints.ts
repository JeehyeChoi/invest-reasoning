import type { FactorKey, FactorMetricRole } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { SecMetricKey } from "@/shared/sec/metrics";
import type { MarketPriceMetricKey } from "@/shared/market/priceMetrics";

export type FactorBlueprintMetricKey =
  | SecMetricKey
  | MarketPriceMetricKey;

export type FactorBlueprintAxis = {
  metricKeys: FactorBlueprintMetricKey[];
  primaryMetricKey: FactorBlueprintMetricKey | null;
  metricProfiles?: Partial<
    Record<FactorBlueprintMetricKey, FactorBlueprintMetricProfile>
  >;
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
  [factor in FactorKey]: Partial<Record<FactorAxisKey, FactorBlueprintAxis>>;
}>;

const EMPTY_FACTOR_AXIS_BLUEPRINT: FactorBlueprintAxis = {
  metricKeys: [],
  primaryMetricKey: null,
};

export const FACTOR_BLUEPRINTS: FactorBlueprintMap = {
  consumer_linked: {
    etf_exposure: EMPTY_FACTOR_AXIS_BLUEPRINT,
  },
  capex_cycle: {
    fundamentals_based: {
      metricKeys: [
        "capex_cash",
        "capex_incurred",
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
  },
  rate_sensitive: {
    fundamentals_based: {
      metricKeys: [
        "interest_expense",
        "net_interest_nonoperating",
        "interest_income",
        "long_term_debt",
        "short_term_debt",
        "total_debt",
        "cash_and_cash_equivalents",
        "cash_and_short_term_investments",
      ],
      primaryMetricKey: "interest_expense",
      metricProfiles: {
        interest_expense: {
          role: "core",
        },
        net_interest_nonoperating: {
          role: "core",
        },
        interest_income: {
          role: "supporting",
        },
        long_term_debt: {
          role: "core",
        },
        short_term_debt: {
          role: "supporting",
        },
        total_debt: {
          role: "core",
        },
        cash_and_cash_equivalents: {
          role: "supporting",
        },
        cash_and_short_term_investments: {
          role: "supporting",
        },
      },
    },
    market_price: {
      metricKeys: ["price"],
      primaryMetricKey: "price",
      metricProfiles: {
        price: {
          role: "core",
        },
      },
    },
    macro_linked: EMPTY_FACTOR_AXIS_BLUEPRINT,
  },
  credit_sensitive: {
    market_price: EMPTY_FACTOR_AXIS_BLUEPRINT,
    macro_linked: EMPTY_FACTOR_AXIS_BLUEPRINT,
  },
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
    market_price: EMPTY_FACTOR_AXIS_BLUEPRINT,
    narrative_implied: {
      metricKeys: [],
      primaryMetricKey: null,
    },
  },
  china_exposure: {
    narrative_implied: EMPTY_FACTOR_AXIS_BLUEPRINT,
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
    market_price: {
      metricKeys: ["price"],
      primaryMetricKey: "price",
      metricProfiles: {
        price: {
          role: "core",
        },
      },
    },
    macro_linked: EMPTY_FACTOR_AXIS_BLUEPRINT,
  },
  duration_sensitive: {
    market_price: EMPTY_FACTOR_AXIS_BLUEPRINT,
    macro_linked: EMPTY_FACTOR_AXIS_BLUEPRINT,
  },
  liquidity_sensitive: {
    fundamentals_based: {
      metricKeys: [
        "accounts_receivable",
        "inventory",
        "accounts_payable",
      ],
      primaryMetricKey: "accounts_receivable",
      metricProfiles: {
        accounts_receivable: {
          role: "core",
        },
        inventory: {
          role: "core",
        },
        accounts_payable: {
          role: "supporting",
        },
      },
    },
  },
  inflation_hedge: {
    market_price: EMPTY_FACTOR_AXIS_BLUEPRINT,
    macro_linked: EMPTY_FACTOR_AXIS_BLUEPRINT,
  },
  commodity_linked: {
    market_price: EMPTY_FACTOR_AXIS_BLUEPRINT,
    macro_linked: EMPTY_FACTOR_AXIS_BLUEPRINT,
  },
  reshoring_defense: {
    narrative_implied: EMPTY_FACTOR_AXIS_BLUEPRINT,
  },
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
    valuation: {
      metricKeys: ["price"],
      primaryMetricKey: "price",
      metricProfiles: {
        price: {
          role: "core",
        },
      },
    },
  },
  value: {
    fundamentals_based: {
      metricKeys: [
        "assets",
        "stockholders_equity",
        "retained_earnings",
        "cash_and_cash_equivalents",
        "liabilities",
        "long_term_debt",
      ],
      primaryMetricKey: "stockholders_equity",
      metricProfiles: {
        assets: {
          role: "supporting",
        },
        stockholders_equity: {
          role: "core",
        },
        retained_earnings: {
          role: "supporting",
        },
        cash_and_cash_equivalents: {
          role: "supporting",
        },
        liabilities: {
          role: "context",
        },
        long_term_debt: {
          role: "context",
        },
      },
    },
    valuation: {
      metricKeys: ["price"],
      primaryMetricKey: "price",
      metricProfiles: {
        price: {
          role: "core",
        },
      },
    },
  },
  cyclical: {
    market_price: EMPTY_FACTOR_AXIS_BLUEPRINT,
    macro_linked: EMPTY_FACTOR_AXIS_BLUEPRINT,
  },
  income: {
    fundamentals_based: {
      metricKeys: [
        "dividend_payments",
        "dividends_per_share",
        "share_repurchases",
        "shares_outstanding",
        "operating_cash_flow",
      ],
      primaryMetricKey: "dividend_payments",
      metricProfiles: {
        dividend_payments: {
          role: "core",
        },
        dividends_per_share: {
          role: "core",
        },
        share_repurchases: {
          role: "supporting",
        },
        shares_outstanding: {
          role: "supporting",
        },
        operating_cash_flow: {
          role: "supporting",
        },
      },
    },
    market_price: EMPTY_FACTOR_AXIS_BLUEPRINT,
    valuation: {
      metricKeys: ["price"],
      primaryMetricKey: "price",
      metricProfiles: {
        price: {
          role: "core",
        },
      },
    },
  },
  size: {
    valuation: {
      metricKeys: ["price"],
      primaryMetricKey: "price",
      metricProfiles: {
        price: {
          role: "core",
        },
      },
    },
    market_price: EMPTY_FACTOR_AXIS_BLUEPRINT,
  },
  momentum: {
    market_price: {
      metricKeys: ["price"],
      primaryMetricKey: "price",
      metricProfiles: {
        price: {
          role: "core",
        },
      },
    },
  },
  high_beta: {
    market_price: {
      metricKeys: ["price"],
      primaryMetricKey: "price",
      metricProfiles: {
        price: {
          role: "core",
        },
      },
    },
  },
  low_volatility: {
    market_price: {
      metricKeys: ["price"],
      primaryMetricKey: "price",
      metricProfiles: {
        price: {
          role: "core",
        },
      },
    },
  },
  quality: {
    fundamentals_based: {
      metricKeys: [
        "gross_profit",
        "operating_income",
        "operating_cash_flow",
        "net_income",
      ],
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
        net_income: {
          role: "supporting",
        },
      },
    },
  },
};

export function getFactorMetricRole(input: {
  factor: FactorKey;
  axis: FactorAxisKey;
  metricKey: FactorBlueprintMetricKey | string;
}): FactorMetricRole {
  const axisBlueprint = FACTOR_BLUEPRINTS[input.factor]?.[input.axis];
  const metricKey = input.metricKey as FactorBlueprintMetricKey;
  const explicitRole = axisBlueprint?.metricProfiles?.[metricKey]?.role;

  if (explicitRole) return explicitRole;
  if (axisBlueprint?.primaryMetricKey === metricKey) return "core";

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
