// src/backend/services/sec/companyFacts/series/tagMeta.ts

import type { SecCompanyFactsMetricKey } from "@/backend/config/sec/metrics";
import type { CompanyFactType } from "@/backend/services/sec/companyFacts/series/types";

export type CompanyFactsSeriesTagMeta = {
  metricKey: SecCompanyFactsMetricKey;
  factType: CompanyFactType;
  priority: number;
  tagFamily?: CompanyFactsSeriesTagFamily;
};

export type CompanyFactsSeriesTagFamily =
  | "revenue_core"
  | "revenue_sales_split"
  | "revenue_financial_net"
  | "revenue_real_estate"
  | "revenue_utility"
  | "revenue_healthcare"
  | "energy_exploration"
  | "energy_oil_gas_capitalized_costs"
  | "energy_inventory"
  | "energy_input_cost"
  | "energy_revenue";

function flow(
  metricKey: SecCompanyFactsMetricKey,
  priority: number,
  options: { tagFamily?: CompanyFactsSeriesTagFamily } = {},
): CompanyFactsSeriesTagMeta {
  return {
    metricKey,
    factType: "flow",
    priority,
    tagFamily: options.tagFamily,
  };
}

function instant(
  metricKey: SecCompanyFactsMetricKey,
  priority = 99,
  options: { tagFamily?: CompanyFactsSeriesTagFamily } = {},
): CompanyFactsSeriesTagMeta {
  return {
    metricKey,
    factType: "instant",
    priority,
    tagFamily: options.tagFamily,
  };
}

function perShare(
  metricKey: SecCompanyFactsMetricKey,
  priority = 99,
): CompanyFactsSeriesTagMeta {
  return {
    metricKey,
    factType: "per_share",
    priority,
  };
}

function shareCount(
  metricKey: SecCompanyFactsMetricKey,
  priority = 99,
): CompanyFactsSeriesTagMeta {
  return {
    metricKey,
    factType: "share_count",
    priority,
  };
}

export const COMPANY_FACTS_SERIES_TAG_META: Record<
  string,
  CompanyFactsSeriesTagMeta
> = {
  // ---------------------------------------------------------------------------
  // Active fundamentals_based operating metrics
  // ---------------------------------------------------------------------------

  // revenue
  Revenues: flow("revenue", 1, { tagFamily: "revenue_core" }),
  RevenueFromContractWithCustomerExcludingAssessedTax: flow("revenue", 2, {
    tagFamily: "revenue_core",
  }),
  RevenueFromContractWithCustomerIncludingAssessedTax: flow("revenue", 3, {
    tagFamily: "revenue_core",
  }),
  SalesRevenueNet: flow("revenue", 4, { tagFamily: "revenue_core" }),
  SalesRevenueGoodsNet: flow("revenue", 5, {
    tagFamily: "revenue_sales_split",
  }),
  SalesRevenueServicesNet: flow("revenue", 6, {
    tagFamily: "revenue_sales_split",
  }),
  RegulatedAndUnregulatedOperatingRevenue: flow("revenue", 7, {
    tagFamily: "revenue_utility",
  }),
  ElectricUtilityRevenue: flow("revenue", 8, {
    tagFamily: "revenue_utility",
  }),
  HealthCareOrganizationPatientServiceRevenueLessProvisionForBadDebts: flow(
    "revenue",
    9,
    { tagFamily: "revenue_healthcare" },
  ),
  HealthCareOrganizationPatientServiceRevenue: flow("revenue", 10, {
    tagFamily: "revenue_healthcare",
  }),
  RevenuesNetOfInterestExpense: flow("revenue", 11, {
    tagFamily: "revenue_financial_net",
  }),
  RealEstateRevenueNet: flow("revenue", 12, {
    tagFamily: "revenue_real_estate",
  }),




  // net income
  NetIncomeLoss: flow("net_income", 1),
  ProfitLoss: flow("net_income", 2),
  // operating income
  OperatingIncomeLoss: flow("operating_income", 1),
  IncomeFromOperations: flow("operating_income", 2),
  // gross profit
  GrossProfit: flow("gross_profit", 1),



  // operating cash flow
  NetCashProvidedByUsedInOperatingActivities: flow("operating_cash_flow", 1),
  NetCashProvidedByUsedInOperatingActivitiesContinuingOperations: flow(
    "operating_cash_flow",
    2,
  ),

  // capital expenditure / capex_cycle metrics
  PaymentsToAcquirePropertyPlantAndEquipment: flow("capex_cash", 1),
  PaymentsToAcquireProductiveAssets: flow("capex_cash", 2),
  CapitalExpendituresIncurredButNotYetPaid: flow("capex_unpaid", 1),
  CapitalExpendituresIncurredButNotPaid: flow("capex_unpaid", 2),

  // energy_linked sector-aware metrics
  ExplorationExpense: flow("energy_exploration_expense", 1, {
    tagFamily: "energy_exploration",
  }),
  CapitalizedExploratoryWellCostChargedToExpense1: flow(
    "energy_exploration_expense",
    2,
    { tagFamily: "energy_exploration" },
  ),

  CapitalizedCostsOilAndGasProducingActivitiesNet: instant(
    "oil_gas_capitalized_costs",
    1,
    { tagFamily: "energy_oil_gas_capitalized_costs" },
  ),
  CapitalizedCostsOilAndGasProducingActivitiesGross: instant(
    "oil_gas_capitalized_costs",
    2,
    { tagFamily: "energy_oil_gas_capitalized_costs" },
  ),
  CapitalizedExploratoryWellCosts: instant(
    "oil_gas_capitalized_costs",
    3,
    { tagFamily: "energy_oil_gas_capitalized_costs" },
  ),
  CapitalizedExploratoryWellCostAdditionsPendingDeterminationOfProvedReserves:
    instant("oil_gas_capitalized_costs", 4, {
      tagFamily: "energy_oil_gas_capitalized_costs",
    }),

  InventoryCrudeOilProductsAndMerchandise: instant("energy_inventory", 1, {
    tagFamily: "energy_inventory",
  }),
  CrudeOilAndNaturalGasLiquids: instant("energy_inventory", 2, {
    tagFamily: "energy_inventory",
  }),
  EnergyRelatedInventoryNaturalGasInStorage: instant("energy_inventory", 3, {
    tagFamily: "energy_inventory",
  }),
  EnergyRelatedInventoryGasStoredUnderground: instant("energy_inventory", 4, {
    tagFamily: "energy_inventory",
  }),

  CostOfPurchasedOilAndGas: flow("energy_input_cost", 1, {
    tagFamily: "energy_input_cost",
  }),
  UtilitiesOperatingExpenseGasAndPetroleumPurchased: flow(
    "energy_input_cost",
    2,
    { tagFamily: "energy_input_cost" },
  ),
  CostOfNaturalGasPurchases: flow("energy_input_cost", 3, {
    tagFamily: "energy_input_cost",
  }),

  GasDomesticRegulatedRevenue: flow("energy_revenue", 1, {
    tagFamily: "energy_revenue",
  }),
  RegulatedOperatingRevenueGas: flow("energy_revenue", 2, {
    tagFamily: "energy_revenue",
  }),

  // ---------------------------------------------------------------------------
  // Candidate / inactive metrics
  // These are mapped for tag-series capture, but not necessarily active factors.
  // ---------------------------------------------------------------------------

  // tax
  IncomeTaxExpenseBenefit: flow("income_tax_expense", 99),

  // expenses
  OperatingExpenses: flow("operating_expenses", 99),
  ResearchAndDevelopmentExpense: flow("research_and_development_expense", 99),
  SellingGeneralAndAdministrativeExpense: flow(
    "selling_general_and_administrative_expense",
    99,
  ),
  CostOfGoodsAndServicesSold: flow("cost_of_goods_sold", 99),
  CostOfGoodsSold: flow("cost_of_goods_sold", 100),

  // balance sheet
  Assets: instant("assets"),
  Liabilities: instant("liabilities"),
  StockholdersEquity: instant("stockholders_equity", 1),
  StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest:
    instant("stockholders_equity", 2),
  CashAndCashEquivalentsAtCarryingValue: instant("cash_and_cash_equivalents"),
  LongTermDebtAndCapitalLeaseObligations: instant("long_term_debt"),
  CommonStocksIncludingAdditionalPaidInCapital: instant("common_stock_and_apic"),
  RetainedEarningsAccumulatedDeficit: instant("retained_earnings"),

  // cash flow candidates
  NetCashProvidedByUsedInInvestingActivities: flow("investing_cash_flow", 99),
  NetCashProvidedByUsedInInvestingActivitiesContinuingOperations: flow(
    "investing_cash_flow",
    100,
  ),
  NetCashProvidedByUsedInFinancingActivities: flow("financing_cash_flow", 99),
  NetCashProvidedByUsedInFinancingActivitiesContinuingOperations: flow(
    "financing_cash_flow",
    100,
  ),

  // dividends / shareholder return
  PaymentsOfDividends: flow("dividend_payments", 99),
  CommonStockDividendsPerShareDeclared: perShare("dividends_per_share"),

  // other operating items
  ShareBasedCompensation: flow("share_based_compensation", 99),
  DepreciationDepletionAndAmortization: flow(
    "depreciation_depletion_and_amortization",
    99,
  ),
  InterestExpense: flow("interest_expense", 99),
  InterestIncomeExpenseNonoperatingNet: flow("net_interest_nonoperating", 99),

  // eps
  EarningsPerShareBasic: perShare("eps_basic", 1),
  EarningsPerShareDiluted: perShare("eps_diluted", 1),

  // share counts
  WeightedAverageNumberOfSharesOutstandingBasic: shareCount(
    "weighted_avg_shares_basic",
  ),
  WeightedAverageNumberOfDilutedSharesOutstanding: shareCount(
    "weighted_avg_shares_diluted",
  ),

  // dei
  EntityCommonStockSharesOutstanding: instant("shares_outstanding", 1),
  CommonStockSharesOutstanding: instant("shares_outstanding", 2),
  EntityPublicFloat: instant("public_float"),
};
