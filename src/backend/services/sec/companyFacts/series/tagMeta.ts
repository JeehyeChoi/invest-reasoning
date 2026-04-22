// src/backend/services/sec/companyFacts/series/tagMeta.ts

import type { CompanyFactType } from "@/backend/services/sec/companyFacts/series/types";

export type CompanyFactsSeriesTagMeta = {
  metricKey: string;
  factType: CompanyFactType;
};

export const COMPANY_FACTS_SERIES_TAG_META: Record<
  string,
  CompanyFactsSeriesTagMeta
> = {
  // revenue
  Revenues: {
    metricKey: "revenue",
    factType: "flow",
  },
  RevenueFromContractWithCustomerExcludingAssessedTax: {
    metricKey: "revenue",
    factType: "flow",
  },
  SalesRevenueNet: {
    metricKey: "revenue",
    factType: "flow",
  },

  // profitability
  GrossProfit: {
    metricKey: "gross_profit",
    factType: "flow",
  },
  OperatingIncomeLoss: {
    metricKey: "operating_income",
    factType: "flow",
  },
  IncomeFromOperations: {
    metricKey: "operating_income",
    factType: "flow",
  },
  NetIncomeLoss: {
    metricKey: "net_income",
    factType: "flow",
  },
  ProfitLoss: {
    metricKey: "net_income",
    factType: "flow",
  },
  IncomeTaxExpenseBenefit: {
    metricKey: "income_tax_expense",
    factType: "flow",
  },

  // expenses
  OperatingExpenses: {
    metricKey: "operating_expenses",
    factType: "flow",
  },
  ResearchAndDevelopmentExpense: {
    metricKey: "research_and_development_expense",
    factType: "flow",
  },
  SellingGeneralAndAdministrativeExpense: {
    metricKey: "selling_general_and_administrative_expense",
    factType: "flow",
  },
  CostOfGoodsAndServicesSold: {
    metricKey: "cost_of_goods_sold",
    factType: "flow",
  },
  CostOfGoodsSold: {
    metricKey: "cost_of_goods_sold",
    factType: "flow",
  },

  // balance sheet
  Assets: {
    metricKey: "assets",
    factType: "instant",
  },
  Liabilities: {
    metricKey: "liabilities",
    factType: "instant",
  },
  StockholdersEquity: {
    metricKey: "stockholders_equity",
    factType: "instant",
  },
  StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest: {
    metricKey: "stockholders_equity",
    factType: "instant",
  },
  CashAndCashEquivalentsAtCarryingValue: {
    metricKey: "cash_and_cash_equivalents",
    factType: "instant",
  },
  LongTermDebtAndCapitalLeaseObligations: {
    metricKey: "long_term_debt",
    factType: "instant",
  },
  CommonStocksIncludingAdditionalPaidInCapital: {
    metricKey: "common_stock_and_apic",
    factType: "instant",
  },
  RetainedEarningsAccumulatedDeficit: {
    metricKey: "retained_earnings",
    factType: "instant",
  },

  // cash flow
  NetCashProvidedByUsedInOperatingActivities: {
    metricKey: "operating_cash_flow",
    factType: "flow",
  },
  NetCashProvidedByUsedInOperatingActivitiesContinuingOperations: {
    metricKey: "operating_cash_flow",
    factType: "flow",
  },
  NetCashProvidedByUsedInInvestingActivities: {
    metricKey: "investing_cash_flow",
    factType: "flow",
  },
  NetCashProvidedByUsedInInvestingActivitiesContinuingOperations: {
    metricKey: "investing_cash_flow",
    factType: "flow",
  },
  NetCashProvidedByUsedInFinancingActivities: {
    metricKey: "financing_cash_flow",
    factType: "flow",
  },
  NetCashProvidedByUsedInFinancingActivitiesContinuingOperations: {
    metricKey: "financing_cash_flow",
    factType: "flow",
  },

  // dividends / shareholder return
  PaymentsOfDividends: {
    metricKey: "dividend_payments",
    factType: "flow",
  },
  CommonStockDividendsPerShareDeclared: {
    metricKey: "dividends_per_share",
    factType: "per_share",
  },

  // other operating items
  ShareBasedCompensation: {
    metricKey: "share_based_compensation",
    factType: "flow",
  },
  DepreciationDepletionAndAmortization: {
    metricKey: "depreciation_depletion_and_amortization",
    factType: "flow",
  },
  InterestExpense: {
    metricKey: "interest_expense",
    factType: "flow",
  },
  InterestIncomeExpenseNonoperatingNet: {
    metricKey: "net_interest_nonoperating",
    factType: "flow",
  },

  // eps
  EarningsPerShareBasic: {
    metricKey: "eps_basic",
    factType: "per_share",
  },
  EarningsPerShareDiluted: {
    metricKey: "eps_diluted",
    factType: "per_share",
  },

  // share counts
  WeightedAverageNumberOfSharesOutstandingBasic: {
    metricKey: "weighted_avg_shares_basic",
    factType: "share_count",
  },
  WeightedAverageNumberOfDilutedSharesOutstanding: {
    metricKey: "weighted_avg_shares_diluted",
    factType: "share_count",
  },

  // dei
  EntityCommonStockSharesOutstanding: {
    metricKey: "shares_outstanding",
    factType: "instant",
  },
  CommonStockSharesOutstanding: {
    metricKey: "shares_outstanding",
    factType: "instant",
  },
  EntityPublicFloat: {
    metricKey: "public_float",
    factType: "instant",
  },
};
