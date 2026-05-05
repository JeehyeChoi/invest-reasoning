import type { SecMetricKey } from "@/shared/sec/metrics";
import { FRED_MACRO_SERIES_DEFINITIONS } from "@/backend/services/macro/fred/macroFredSeriesRegistry";
import type {
  FredMacroSeriesDefinition,
  FredMacroSeriesKey,
} from "@/backend/services/macro/fred/types";

export function resolveFredMacroSeriesForMetric(
  metricKey: SecMetricKey,
): FredMacroSeriesDefinition[] {
  switch (metricKey) {
    case "capex_cash":
    case "capex_incurred":
      return resolveFredMacroSeriesByKeys([
        "private_investment_yoy",
        "nonresidential_fixed_investment_yoy",
      ]);
    case "gross_profit":
    case "net_income":
    case "operating_cash_flow":
    case "operating_income":
      return resolveFredMacroSeriesByKeys([
        "corporate_profits_yoy",
        "nominal_gdp_yoy",
      ]);
    case "revenue":
      return resolveFredMacroSeriesByKeys([
        "nominal_gdp_yoy",
        "real_gdp_yoy",
        "pce_inflation_yoy",
      ]);
    default:
      return resolveFredMacroSeriesByKeys(["nominal_gdp_yoy", "real_gdp_yoy"]);
  }
}

function resolveFredMacroSeriesByKeys(
  keys: FredMacroSeriesKey[],
): FredMacroSeriesDefinition[] {
  return keys.map((key) => {
    const definition = FRED_MACRO_SERIES_DEFINITIONS.find(
      (candidate) => candidate.key === key,
    );

    if (!definition) {
      throw new Error(`Unknown FRED macro series key: ${key}`);
    }

    return definition;
  });
}
