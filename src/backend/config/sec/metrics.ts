import type { SecMetricKey } from "@/shared/sec/metrics";
import { SEC_METRIC_KEYS, isSecMetricKey } from "@/shared/sec/metrics";

export type { SecMetricKey } from "@/shared/sec/metrics";

export type SecMetricKind = "canonical" | "derived" | "internal";
export type SecMetricDurationPolicy =
  | "duration_adjust_growth"
  | "reported_only"
  | "not_applicable";

export const SEC_METRIC_DEFINITIONS = {
  revenue: { kind: "canonical", durationPolicy: "duration_adjust_growth" },
  net_income: { kind: "canonical", durationPolicy: "duration_adjust_growth" },
  operating_income: { kind: "canonical", durationPolicy: "duration_adjust_growth" },
  gross_profit: { kind: "canonical", durationPolicy: "duration_adjust_growth" },
  operating_cash_flow: { kind: "canonical", durationPolicy: "duration_adjust_growth" },
  capex_cash: { kind: "canonical", durationPolicy: "reported_only" },
  capex_incurred: { kind: "derived", durationPolicy: "reported_only" },
  capex_unpaid: { kind: "internal", durationPolicy: "reported_only" },

  income_tax_expense: { kind: "internal", durationPolicy: "duration_adjust_growth" },
  operating_expenses: { kind: "internal", durationPolicy: "duration_adjust_growth" },
  research_and_development_expense: { kind: "internal", durationPolicy: "duration_adjust_growth" },
  selling_general_and_administrative_expense: { kind: "internal", durationPolicy: "duration_adjust_growth" },
  cost_of_goods_sold: { kind: "internal", durationPolicy: "duration_adjust_growth" },
  depreciation_depletion_and_amortization: { kind: "internal", durationPolicy: "reported_only" },
  interest_expense: { kind: "internal", durationPolicy: "duration_adjust_growth" },
  net_interest_nonoperating: { kind: "internal", durationPolicy: "duration_adjust_growth" },
  eps_basic: { kind: "internal", durationPolicy: "not_applicable" },
  eps_diluted: { kind: "internal", durationPolicy: "not_applicable" },
  weighted_avg_shares_basic: { kind: "internal", durationPolicy: "not_applicable" },
  weighted_avg_shares_diluted: { kind: "internal", durationPolicy: "not_applicable" },
  dividends_per_share: { kind: "canonical", durationPolicy: "not_applicable" },
  dividend_payments: { kind: "canonical", durationPolicy: "reported_only" },
  investing_cash_flow: { kind: "internal", durationPolicy: "reported_only" },
  financing_cash_flow: { kind: "internal", durationPolicy: "reported_only" },
  cash_and_cash_equivalents: { kind: "internal", durationPolicy: "not_applicable" },
  assets: { kind: "internal", durationPolicy: "not_applicable" },
  liabilities: { kind: "canonical", durationPolicy: "not_applicable" },
  long_term_debt: { kind: "internal", durationPolicy: "not_applicable" },
  stockholders_equity: { kind: "canonical", durationPolicy: "not_applicable" },
  common_stock_and_apic: { kind: "internal", durationPolicy: "not_applicable" },
  retained_earnings: { kind: "internal", durationPolicy: "not_applicable" },
  share_based_compensation: { kind: "internal", durationPolicy: "reported_only" },
  shares_outstanding: { kind: "internal", durationPolicy: "not_applicable" },
  public_float: { kind: "internal", durationPolicy: "not_applicable" },

  energy_exploration_expense: { kind: "canonical", durationPolicy: "duration_adjust_growth" },
  oil_gas_capitalized_costs: { kind: "canonical", durationPolicy: "not_applicable" },
  energy_inventory: { kind: "canonical", durationPolicy: "not_applicable" },
  energy_input_cost: { kind: "canonical", durationPolicy: "duration_adjust_growth" },
  energy_revenue: { kind: "canonical", durationPolicy: "duration_adjust_growth" },
} as const satisfies Record<
  SecMetricKey,
  {
    kind: SecMetricKind;
    durationPolicy: SecMetricDurationPolicy;
  }
>;

export type SecCanonicalMetricKey = {
  [K in SecMetricKey]: (typeof SEC_METRIC_DEFINITIONS)[K]["kind"] extends "canonical"
    ? K
    : never;
}[SecMetricKey];

export type SecDerivedMetricKey = {
  [K in SecMetricKey]: (typeof SEC_METRIC_DEFINITIONS)[K]["kind"] extends "derived"
    ? K
    : never;
}[SecMetricKey];

export type SecInternalMetricKey = {
  [K in SecMetricKey]: (typeof SEC_METRIC_DEFINITIONS)[K]["kind"] extends "internal"
    ? K
    : never;
}[SecMetricKey];

export type SecCompanyFactsMetricKey = Exclude<SecMetricKey, SecDerivedMetricKey>;

export const SEC_CANONICAL_METRIC_KEYS = SEC_METRIC_KEYS.filter(
  (metricKey): metricKey is SecCanonicalMetricKey =>
    SEC_METRIC_DEFINITIONS[metricKey].kind === "canonical",
);

export const SEC_DERIVED_METRIC_KEYS = SEC_METRIC_KEYS.filter(
  (metricKey): metricKey is SecDerivedMetricKey =>
    SEC_METRIC_DEFINITIONS[metricKey].kind === "derived",
);

export const SEC_INTERNAL_METRIC_KEYS = SEC_METRIC_KEYS.filter(
  (metricKey): metricKey is SecInternalMetricKey =>
    SEC_METRIC_DEFINITIONS[metricKey].kind === "internal",
);

export function isCanonicalSecMetricKey(
  value: string,
): value is SecCanonicalMetricKey {
  return (
    isSecMetricKey(value) && SEC_METRIC_DEFINITIONS[value].kind === "canonical"
  );
}

export function isDerivedSecMetricKey(
  value: string,
): value is SecDerivedMetricKey {
  return (
    isSecMetricKey(value) && SEC_METRIC_DEFINITIONS[value].kind === "derived"
  );
}

export function isInternalSecMetricKey(
  value: string,
): value is SecInternalMetricKey {
  return (
    isSecMetricKey(value) && SEC_METRIC_DEFINITIONS[value].kind === "internal"
  );
}

export function getSecMetricKind(metricKey: SecMetricKey): SecMetricKind {
  return SEC_METRIC_DEFINITIONS[metricKey].kind;
}

export function isFactorEnabledSecMetricKey(
  metricKey: SecMetricKey,
): boolean {
  return SEC_METRIC_DEFINITIONS[metricKey].kind !== "internal";
}

export function shouldValidateSecMetricKey(
  metricKey: SecMetricKey,
): boolean {
  return SEC_METRIC_DEFINITIONS[metricKey].kind === "canonical";
}

export function isChartEnabledSecMetricKey(
  metricKey: SecMetricKey,
): boolean {
  return SEC_METRIC_DEFINITIONS[metricKey].kind !== "internal";
}

export function isCompanyFactsMetricKey(
  metricKey: SecMetricKey,
): boolean {
  return SEC_METRIC_DEFINITIONS[metricKey].kind !== "derived";
}
