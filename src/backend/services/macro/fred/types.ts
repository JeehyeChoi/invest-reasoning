export type FredMacroSeriesKey =
  | "nominal_gdp_yoy"
  | "real_gdp_yoy"
  | "pce_inflation_yoy"
  | "private_investment_yoy"
  | "nonresidential_fixed_investment_yoy"
  | "corporate_profits_yoy";

export type FredMacroSeriesDefinition = {
  key: FredMacroSeriesKey;
  seriesId: string;
  units: "pc1";
  frequency: "quarterly" | "monthly";
  label: string;
  description: string;
};
