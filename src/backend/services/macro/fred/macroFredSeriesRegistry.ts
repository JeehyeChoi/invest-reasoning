import type { FredMacroSeriesDefinition } from "@/backend/services/macro/fred/types";

export const FRED_MACRO_SERIES_DEFINITIONS = [
  {
    key: "nominal_gdp_yoy",
    seriesId: "GDP",
    units: "pc1",
    frequency: "quarterly",
    label: "Nominal GDP YoY",
    description: "U.S. nominal gross domestic product percent change from year ago.",
  },
  {
    key: "real_gdp_yoy",
    seriesId: "GDPC1",
    units: "pc1",
    frequency: "quarterly",
    label: "Real GDP YoY",
    description: "U.S. real gross domestic product percent change from year ago.",
  },
  {
    key: "pce_inflation_yoy",
    seriesId: "PCEPI",
    units: "pc1",
    frequency: "monthly",
    label: "PCE Inflation YoY",
    description: "U.S. PCE price index percent change from year ago.",
  },
  {
    key: "private_investment_yoy",
    seriesId: "GPDI",
    units: "pc1",
    frequency: "quarterly",
    label: "Private Investment YoY",
    description:
      "U.S. gross private domestic investment percent change from year ago.",
  },
  {
    key: "nonresidential_fixed_investment_yoy",
    seriesId: "PNFI",
    units: "pc1",
    frequency: "quarterly",
    label: "Nonresidential Fixed Investment YoY",
    description:
      "U.S. private nonresidential fixed investment percent change from year ago.",
  },
  {
    key: "corporate_profits_yoy",
    seriesId: "CP",
    units: "pc1",
    frequency: "quarterly",
    label: "Corporate Profits YoY",
    description: "U.S. corporate profits after tax percent change from year ago.",
  },
  {
    key: "sp500_index",
    seriesId: "SP500",
    units: "lin",
    frequency: "daily",
    label: "S&P 500 Index",
    description:
      "S&P 500 daily close index level from FRED. Used as the clean index benchmark where recent history is sufficient.",
  },
  {
    key: "vix_index",
    seriesId: "VIXCLS",
    units: "lin",
    frequency: "daily",
    label: "CBOE Volatility Index",
    description:
      "VIX daily close index level from FRED. Used as a market-implied volatility and stress backdrop series.",
  },
  {
    key: "high_yield_oas",
    seriesId: "BAMLH0A0HYM2",
    units: "lin",
    frequency: "daily",
    label: "High Yield Credit Spread",
    description:
      "ICE BofA US High Yield Index option-adjusted spread. Used as a credit stress and risk-appetite backdrop series.",
  },
  {
    key: "investment_grade_oas",
    seriesId: "BAMLC0A0CM",
    units: "lin",
    frequency: "daily",
    label: "Investment Grade Credit Spread",
    description:
      "ICE BofA US Corporate Index option-adjusted spread. Used as an investment-grade credit stress backdrop series.",
  },
  {
    key: "treasury_10y_yield",
    seriesId: "DGS10",
    units: "lin",
    frequency: "daily",
    label: "10-Year Treasury Yield",
    description:
      "Market yield on U.S. Treasury securities at 10-year constant maturity. Used as the long-rate backdrop for duration and valuation context.",
  },
  {
    key: "treasury_2y_yield",
    seriesId: "DGS2",
    units: "lin",
    frequency: "daily",
    label: "2-Year Treasury Yield",
    description:
      "Market yield on U.S. Treasury securities at 2-year constant maturity. Used as the front-end policy-rate expectation backdrop.",
  },
  {
    key: "treasury_5y_yield",
    seriesId: "DGS5",
    units: "lin",
    frequency: "daily",
    label: "5-Year Treasury Yield",
    description:
      "Market yield on U.S. Treasury securities at 5-year constant maturity. Used as the intermediate-rate backdrop for duration-sensitive factor analysis.",
  },
  {
    key: "treasury_30y_yield",
    seriesId: "DGS30",
    units: "lin",
    frequency: "daily",
    label: "30-Year Treasury Yield",
    description:
      "Market yield on U.S. Treasury securities at 30-year constant maturity. Used as the ultra-long-rate backdrop for duration-sensitive factor analysis.",
  },
  {
    key: "treasury_10y_2y_spread",
    seriesId: "T10Y2Y",
    units: "lin",
    frequency: "daily",
    label: "10Y-2Y Treasury Spread",
    description:
      "10-year Treasury constant maturity minus 2-year Treasury constant maturity. Used as a yield-curve shape and cycle-risk backdrop series.",
  },
  {
    key: "effective_fed_funds_rate",
    seriesId: "DFF",
    units: "lin",
    frequency: "daily",
    label: "Effective Fed Funds Rate",
    description:
      "Effective federal funds rate. Used as the realized short-rate policy backdrop for rate-sensitive factor analysis.",
  },
  {
    key: "broad_dollar_index",
    seriesId: "DTWEXBGS",
    units: "lin",
    frequency: "daily",
    label: "Broad U.S. Dollar Index",
    description:
      "Nominal broad U.S. dollar index. Used as a dollar and safe-haven backdrop for commodity, inflation, and international exposure context.",
  },
] as const satisfies FredMacroSeriesDefinition[];

export function getFredMacroSeriesDefinitions(): FredMacroSeriesDefinition[] {
  return [...FRED_MACRO_SERIES_DEFINITIONS];
}
