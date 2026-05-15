export const MACRO_LINKED_METRIC_KEYS = [
  "gdp_revenue_sensitivity",
  "investment_revenue_sensitivity",
  "investment_profit_sensitivity",
  "corporate_profit_sensitivity",
] as const;

export type MacroLinkedMetricKey =
  (typeof MACRO_LINKED_METRIC_KEYS)[number];

const MACRO_LINKED_METRIC_KEY_SET = new Set<string>(
  MACRO_LINKED_METRIC_KEYS,
);

export function isMacroLinkedMetricKey(
  value: string,
): value is MacroLinkedMetricKey {
  return MACRO_LINKED_METRIC_KEY_SET.has(value);
}
