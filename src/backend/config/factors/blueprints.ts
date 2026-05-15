import type { FactorKey, FactorMetricRole } from "@/shared/factors/factors";
import type { FactorAxisKey } from "@/shared/factors/axes";
import type { SecMetricKey } from "@/shared/sec/metrics";
import type { MarketPriceMetricKey } from "@/shared/factors/marketPriceMetrics";
import type { EtfExposureMetricKey } from "@/shared/factors/etfExposureMetrics";
import type { ValuationMetricKey } from "@/shared/factors/valuationMetrics";
import type { MacroLinkedMetricKey } from "@/shared/factors/macroLinkedMetrics";

export type FactorBlueprintMetricKey =
  | SecMetricKey
  | MarketPriceMetricKey
  | EtfExposureMetricKey
  | ValuationMetricKey
  | MacroLinkedMetricKey;

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

const MARKET_PRICE_DEFENSIVE_METRIC_KEYS = [
  "down_market_defense_1y",
  "down_market_defense_3y",
  "volatility_stress_defense_1y",
  "volatility_stress_defense_3y",
  "drawdown_defense_1y",
  "downside_capture_defense_1y",
] as const satisfies MarketPriceMetricKey[];

const MARKET_PRICE_MOMENTUM_METRIC_KEYS = [
  "price_return_3m",
  "price_return_6m",
  "price_return_12m",
  "price_momentum_12m_ex_1m",
  "relative_return_3m",
  "relative_return_6m",
  "relative_return_12m",
  "relative_momentum_12m_ex_1m",
  "momentum_consistency_12m",
  "distance_from_52_week_high",
] as const satisfies MarketPriceMetricKey[];

const MARKET_PRICE_LOW_VOLATILITY_METRIC_KEYS = [
  "realized_volatility_1y",
  "realized_volatility_3y",
  "downside_volatility_1y",
  "max_drawdown_1y",
] as const satisfies MarketPriceMetricKey[];

const MARKET_PRICE_HIGH_BETA_METRIC_KEYS = [
  "market_beta_1y",
  "market_beta_3y",
  "correlation_to_market_3y",
  "upside_capture_1y",
  "downside_capture_1y",
  "qqq_beta_1y",
  "qqq_beta_3y",
  "qqq_correlation_3y",
  "dia_beta_1y",
  "dia_beta_3y",
  "dia_correlation_3y",
] as const satisfies MarketPriceMetricKey[];

const MARKET_PRICE_RATE_SENSITIVE_METRIC_KEYS = [
  "rate_up_relative_return_1y",
  "rate_up_relative_return_3y",
  "rate_shock_relative_return_1y",
  "rate_beta_3y",
  "curve_flattening_relative_return_3y",
] as const satisfies MarketPriceMetricKey[];

const MARKET_PRICE_CREDIT_SENSITIVE_METRIC_KEYS = [
  "credit_spread_widening_relative_return_1y",
  "credit_spread_widening_relative_return_3y",
  "credit_shock_relative_return_1y",
  "high_yield_spread_beta_3y",
  "investment_grade_spread_beta_3y",
] as const satisfies MarketPriceMetricKey[];

const MARKET_PRICE_DURATION_SENSITIVE_METRIC_KEYS = [
  "short_rate_beta_3y",
  "intermediate_rate_beta_3y",
  "ultra_long_rate_beta_3y",
  "yield_curve_beta_3y",
  "short_treasury_beta_3y",
  "intermediate_treasury_beta_3y",
  "long_bond_beta_3y",
] as const satisfies MarketPriceMetricKey[];

const VALUATION_GROWTH_METRIC_KEYS = [
  "price_to_diluted_ttm_eps",
  "price_to_basic_ttm_eps",
  "diluted_ttm_eps_growth",
  "basic_ttm_eps_growth",
] as const satisfies ValuationMetricKey[];

const VALUATION_VALUE_METRIC_KEYS = [
  "price_to_book",
  "price_to_sales",
  "price_to_earnings",
  "price_to_operating_cash_flow",
  "free_cash_flow_yield",
  "enterprise_value_to_sales",
] as const satisfies ValuationMetricKey[];

const VALUATION_INCOME_METRIC_KEYS = [
  "dividend_yield",
  "buyback_yield",
  "shareholder_yield",
  "dividend_yield_share",
  "buyback_yield_share",
] as const satisfies ValuationMetricKey[];

const VALUATION_SIZE_METRIC_KEYS = [
  "market_capitalization",
  "log_market_capitalization",
] as const satisfies ValuationMetricKey[];

const ETF_EXPOSURE_ENERGY_LINKED_METRIC_KEYS = [
  "energy_sector_beta_3y",
  "energy_exploration_beta_3y",
  "oil_services_beta_3y",
] as const satisfies EtfExposureMetricKey[];

const ETF_EXPOSURE_COMMODITY_LINKED_METRIC_KEYS = [
  "broad_commodity_beta_3y",
  "gold_beta_3y",
  "silver_beta_3y",
] as const satisfies EtfExposureMetricKey[];

const ETF_EXPOSURE_CONSUMER_LINKED_METRIC_KEYS = [
  "consumer_discretionary_beta_3y",
  "consumer_staples_beta_3y",
  "retail_beta_3y",
] as const satisfies EtfExposureMetricKey[];

const ETF_EXPOSURE_INFLATION_HEDGE_METRIC_KEYS = [
  "inflation_hedge_basket_beta_3y",
] as const satisfies EtfExposureMetricKey[];

const ETF_EXPOSURE_RESHORING_DEFENSE_METRIC_KEYS = [
  "aerospace_defense_beta_3y",
  "infrastructure_beta_3y",
  "power_grid_beta_3y",
] as const satisfies EtfExposureMetricKey[];

const ETF_EXPOSURE_CHINA_EXPOSURE_METRIC_KEYS = [
  "china_large_cap_beta_3y",
  "china_internet_beta_3y",
  "emerging_market_beta_3y",
] as const satisfies EtfExposureMetricKey[];

const MACRO_LINKED_CYCLICAL_METRIC_KEYS = [
  "investment_revenue_sensitivity",
  "investment_profit_sensitivity",
  "corporate_profit_sensitivity",
  "gdp_revenue_sensitivity",
] as const satisfies MacroLinkedMetricKey[];

function buildMetricProfiles(
  metricKeys: readonly FactorBlueprintMetricKey[],
  role: FactorMetricRole = "core",
): Partial<Record<FactorBlueprintMetricKey, FactorBlueprintMetricProfile>> {
  return Object.fromEntries(
    metricKeys.map((metricKey) => [metricKey, { role }]),
  ) as Partial<Record<FactorBlueprintMetricKey, FactorBlueprintMetricProfile>>;
}

export const FACTOR_BLUEPRINTS: FactorBlueprintMap = {
  consumer_linked: {
    etf_exposure: {
      metricKeys: [...ETF_EXPOSURE_CONSUMER_LINKED_METRIC_KEYS],
      primaryMetricKey: "consumer_discretionary_beta_3y",
      metricProfiles: buildMetricProfiles(
        ETF_EXPOSURE_CONSUMER_LINKED_METRIC_KEYS,
      ),
    },
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
      metricKeys: [...MARKET_PRICE_RATE_SENSITIVE_METRIC_KEYS],
      primaryMetricKey: "rate_up_relative_return_1y",
      metricProfiles: buildMetricProfiles(MARKET_PRICE_RATE_SENSITIVE_METRIC_KEYS),
    },
    macro_linked: EMPTY_FACTOR_AXIS_BLUEPRINT,
  },
  credit_sensitive: {
    market_price: {
      metricKeys: [...MARKET_PRICE_CREDIT_SENSITIVE_METRIC_KEYS],
      primaryMetricKey: "credit_spread_widening_relative_return_1y",
      metricProfiles: buildMetricProfiles(
        MARKET_PRICE_CREDIT_SENSITIVE_METRIC_KEYS,
      ),
    },
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
    narrative_implied: {
      metricKeys: [],
      primaryMetricKey: null,
    },
    etf_exposure: {
      metricKeys: [...ETF_EXPOSURE_ENERGY_LINKED_METRIC_KEYS],
      primaryMetricKey: "energy_sector_beta_3y",
      metricProfiles: buildMetricProfiles(ETF_EXPOSURE_ENERGY_LINKED_METRIC_KEYS),
    },
  },
  china_exposure: {
    etf_exposure: {
      metricKeys: [...ETF_EXPOSURE_CHINA_EXPOSURE_METRIC_KEYS],
      primaryMetricKey: "china_large_cap_beta_3y",
      metricProfiles: buildMetricProfiles(ETF_EXPOSURE_CHINA_EXPOSURE_METRIC_KEYS),
    },
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
      metricKeys: [...MARKET_PRICE_DEFENSIVE_METRIC_KEYS],
      primaryMetricKey: "down_market_defense_1y",
      metricProfiles: buildMetricProfiles(MARKET_PRICE_DEFENSIVE_METRIC_KEYS),
    },
    macro_linked: EMPTY_FACTOR_AXIS_BLUEPRINT,
  },
  duration_sensitive: {
    market_price: {
      metricKeys: [...MARKET_PRICE_DURATION_SENSITIVE_METRIC_KEYS],
      primaryMetricKey: "long_bond_beta_3y",
      metricProfiles: buildMetricProfiles(
        MARKET_PRICE_DURATION_SENSITIVE_METRIC_KEYS,
      ),
    },
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
    macro_linked: EMPTY_FACTOR_AXIS_BLUEPRINT,
    etf_exposure: {
      metricKeys: [...ETF_EXPOSURE_INFLATION_HEDGE_METRIC_KEYS],
      primaryMetricKey: "inflation_hedge_basket_beta_3y",
      metricProfiles: buildMetricProfiles(ETF_EXPOSURE_INFLATION_HEDGE_METRIC_KEYS),
    },
  },
  commodity_linked: {
    macro_linked: EMPTY_FACTOR_AXIS_BLUEPRINT,
    etf_exposure: {
      metricKeys: [...ETF_EXPOSURE_COMMODITY_LINKED_METRIC_KEYS],
      primaryMetricKey: "broad_commodity_beta_3y",
      metricProfiles: buildMetricProfiles(
        ETF_EXPOSURE_COMMODITY_LINKED_METRIC_KEYS,
      ),
    },
  },
  reshoring_defense: {
    etf_exposure: {
      metricKeys: [...ETF_EXPOSURE_RESHORING_DEFENSE_METRIC_KEYS],
      primaryMetricKey: "aerospace_defense_beta_3y",
      metricProfiles: buildMetricProfiles(
        ETF_EXPOSURE_RESHORING_DEFENSE_METRIC_KEYS,
      ),
    },
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
      metricKeys: [...VALUATION_GROWTH_METRIC_KEYS],
      primaryMetricKey: "price_to_diluted_ttm_eps",
      metricProfiles: buildMetricProfiles(VALUATION_GROWTH_METRIC_KEYS),
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
      metricKeys: [...VALUATION_VALUE_METRIC_KEYS],
      primaryMetricKey: "price_to_earnings",
      metricProfiles: buildMetricProfiles(VALUATION_VALUE_METRIC_KEYS),
    },
  },
  cyclical: {
    market_price: EMPTY_FACTOR_AXIS_BLUEPRINT,
    macro_linked: {
      metricKeys: [...MACRO_LINKED_CYCLICAL_METRIC_KEYS],
      primaryMetricKey: "investment_revenue_sensitivity",
      metricProfiles: buildMetricProfiles(MACRO_LINKED_CYCLICAL_METRIC_KEYS),
    },
  },
  income: {
    fundamentals_based: {
      metricKeys: [
        "dividend_payments",
        "dividends_per_share",
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
        shares_outstanding: {
          role: "supporting",
        },
        operating_cash_flow: {
          role: "supporting",
        },
      },
    },
    valuation: {
      metricKeys: [...VALUATION_INCOME_METRIC_KEYS],
      primaryMetricKey: "shareholder_yield",
      metricProfiles: buildMetricProfiles(VALUATION_INCOME_METRIC_KEYS),
    },
  },
  size: {
    valuation: {
      metricKeys: [...VALUATION_SIZE_METRIC_KEYS],
      primaryMetricKey: "market_capitalization",
      metricProfiles: buildMetricProfiles(VALUATION_SIZE_METRIC_KEYS),
    },
  },
  momentum: {
    market_price: {
      metricKeys: [...MARKET_PRICE_MOMENTUM_METRIC_KEYS],
      primaryMetricKey: "price_momentum_12m_ex_1m",
      metricProfiles: buildMetricProfiles(MARKET_PRICE_MOMENTUM_METRIC_KEYS),
    },
  },
  high_beta: {
    market_price: {
      metricKeys: [...MARKET_PRICE_HIGH_BETA_METRIC_KEYS],
      primaryMetricKey: "market_beta_1y",
      metricProfiles: {
        ...buildMetricProfiles(MARKET_PRICE_HIGH_BETA_METRIC_KEYS),
        qqq_beta_1y: { role: "context" },
        qqq_beta_3y: { role: "context" },
        qqq_correlation_3y: { role: "context" },
        dia_beta_1y: { role: "context" },
        dia_beta_3y: { role: "context" },
        dia_correlation_3y: { role: "context" },
      },
    },
  },
  low_volatility: {
    market_price: {
      metricKeys: [...MARKET_PRICE_LOW_VOLATILITY_METRIC_KEYS],
      primaryMetricKey: "realized_volatility_1y",
      metricProfiles: buildMetricProfiles(
        MARKET_PRICE_LOW_VOLATILITY_METRIC_KEYS,
      ),
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
