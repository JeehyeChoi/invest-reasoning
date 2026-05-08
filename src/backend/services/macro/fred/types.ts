export type FredMacroSeriesKey =
  | "nominal_gdp_yoy"
  | "real_gdp_yoy"
  | "pce_inflation_yoy"
  | "private_investment_yoy"
  | "nonresidential_fixed_investment_yoy"
  | "corporate_profits_yoy"
  | "sp500_index"
  | "vix_index"
  | "high_yield_oas"
  | "investment_grade_oas"
  | "treasury_10y_yield"
  | "treasury_2y_yield"
  | "treasury_10y_2y_spread"
  | "effective_fed_funds_rate"
  | "broad_dollar_index";

export type FredMacroSeriesDefinition = {
  key: FredMacroSeriesKey;
  seriesId: string;
  units: "pc1" | "lin";
  frequency: "quarterly" | "monthly" | "daily";
  label: string;
  description: string;
};
