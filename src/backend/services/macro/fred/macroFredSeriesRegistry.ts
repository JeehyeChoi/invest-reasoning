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
] as const satisfies FredMacroSeriesDefinition[];

export function getFredMacroSeriesDefinitions(): FredMacroSeriesDefinition[] {
  return [...FRED_MACRO_SERIES_DEFINITIONS];
}
