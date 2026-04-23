export const SEC_METRIC_KEYS = [
  "revenue",
  "net_income",
  "operating_income",
  "gross_profit",
  "income_tax_expense",
  "operating_expenses",
  "research_and_development_expense",
  "selling_general_and_administrative_expense",
  "cost_of_goods_sold",
  "depreciation_depletion_and_amortization",
  "interest_expense",
  "net_interest_nonoperating",
  "eps_basic",
  "eps_diluted",
  "weighted_avg_shares_basic",
  "weighted_avg_shares_diluted",
  "dividends_per_share",
  "dividend_payments",
  "operating_cash_flow",
  "investing_cash_flow",
  "financing_cash_flow",
  "cash_and_cash_equivalents",
  "assets",
  "liabilities",
  "long_term_debt",
  "stockholders_equity",
  "common_stock_and_apic",
  "retained_earnings",
  "share_based_compensation",
  "shares_outstanding",
  "public_float",
] as const;

export type SecMetricKey = (typeof SEC_METRIC_KEYS)[number];

export function isSecMetricKey(value: string): value is SecMetricKey {
  return SEC_METRIC_KEYS.includes(value as SecMetricKey);
}
