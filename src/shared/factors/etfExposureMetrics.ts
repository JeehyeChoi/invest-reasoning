export const ETF_EXPOSURE_METRIC_KEYS = [
  "energy_sector_beta_3y",
  "energy_exploration_beta_3y",
  "oil_services_beta_3y",
  "broad_commodity_beta_3y",
  "gold_beta_3y",
  "silver_beta_3y",
  "consumer_discretionary_beta_3y",
  "consumer_staples_beta_3y",
  "retail_beta_3y",
  "inflation_hedge_basket_beta_3y",
  "aerospace_defense_beta_3y",
  "infrastructure_beta_3y",
  "power_grid_beta_3y",
  "china_large_cap_beta_3y",
  "china_internet_beta_3y",
  "emerging_market_beta_3y",
] as const;

export type EtfExposureMetricKey =
  (typeof ETF_EXPOSURE_METRIC_KEYS)[number];

const ETF_EXPOSURE_METRIC_KEY_SET = new Set<string>(
  ETF_EXPOSURE_METRIC_KEYS,
);

export function isEtfExposureMetricKey(
  value: string,
): value is EtfExposureMetricKey {
  return ETF_EXPOSURE_METRIC_KEY_SET.has(value);
}
