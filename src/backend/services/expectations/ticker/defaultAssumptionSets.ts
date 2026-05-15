export const DEFAULT_ASSUMPTION_SETS = [
  {
    assumptionSetKey: "conservative_5y",
    name: "Conservative 5Y",
    description:
      "Higher discount rate and lower terminal multiples for a stricter implied expectation path.",
    horizonYears: 5,
    discountRate: 0.12,
    terminalEvSalesMultiple: 4,
    terminalPeMultiple: 18,
    terminalOperatingMargin: 0.15,
    displayOrder: 10,
  },
  {
    assumptionSetKey: "base_5y",
    name: "Base 5Y",
    description:
      "Middle assumption set for broad cross-ticker implied financial expectation comparisons.",
    horizonYears: 5,
    discountRate: 0.1,
    terminalEvSalesMultiple: 8,
    terminalPeMultiple: 25,
    terminalOperatingMargin: 0.25,
    displayOrder: 20,
  },
  {
    assumptionSetKey: "growth_5y",
    name: "Growth 5Y",
    description:
      "Lower discount rate and higher terminal multiples for higher-quality or faster-growth expectation paths.",
    horizonYears: 5,
    discountRate: 0.08,
    terminalEvSalesMultiple: 12,
    terminalPeMultiple: 35,
    terminalOperatingMargin: 0.35,
    displayOrder: 30,
  },
] as const;
