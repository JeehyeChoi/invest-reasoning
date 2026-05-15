export type ExpectationAssumptionSetRow = {
  assumption_set_key: string;
  name: string;
  description: string | null;
  horizon_years: number | string;
  discount_rate: number | string;
  terminal_ev_sales_multiple: number | string | null;
  terminal_pe_multiple: number | string | null;
  terminal_operating_margin: number | string | null;
  is_active: boolean;
  display_order: number | string;
};

export type TickerImpliedFinancialExpectationRow = {
  ticker: string;
  cik: string | null;
  assumption_set_key: string;
  as_of_date: Date | string;
  source_version: string;
  current_price: number | string | null;
  current_market_cap: number | string | null;
  current_enterprise_value: number | string | null;
  current_revenue_ttm: number | string | null;
  current_operating_income_ttm: number | string | null;
  current_net_income_ttm: number | string | null;
  current_eps_ttm: number | string | null;
  current_shares_outstanding: number | string | null;
  current_operating_margin: number | string | null;
  current_net_margin: number | string | null;
  current_ev_sales_multiple: number | string | null;
  current_pe_multiple: number | string | null;
  horizon_years: number | string;
  discount_rate: number | string;
  terminal_ev_sales_multiple: number | string | null;
  terminal_pe_multiple: number | string | null;
  terminal_operating_margin: number | string | null;
  implied_terminal_enterprise_value: number | string | null;
  implied_terminal_equity_value: number | string | null;
  implied_revenue_terminal: number | string | null;
  implied_revenue_cagr: number | string | null;
  implied_operating_income_terminal: number | string | null;
  implied_net_income_terminal: number | string | null;
  implied_net_income_cagr: number | string | null;
  implied_eps_terminal: number | string | null;
  implied_eps_cagr: number | string | null;
  expectation_burden_score: number | string | null;
  valuation_fragility_score: number | string | null;
};

export type TickerExpectationSourceRow = {
  ticker: string;
  cik: string | null;
  price_date: Date | string;
  current_price: number | string | null;
  current_market_cap: number | string | null;
  current_enterprise_value: number | string | null;
  current_revenue_ttm: number | string | null;
  current_operating_income_ttm: number | string | null;
  current_net_income_ttm: number | string | null;
  current_eps_ttm: number | string | null;
  current_shares_outstanding: number | string | null;
};

export type TickerExpectationBuildRow = Omit<
  TickerImpliedFinancialExpectationRow,
  "as_of_date"
> & {
  as_of_date: string;
  source_payload: Record<string, unknown>;
};
