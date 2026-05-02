export const FACTOR_SCORING_METHODS = [
  "heuristic",
  "quantitative",
  "modeling",
] as const;

export type FactorScoringMethod =
  (typeof FACTOR_SCORING_METHODS)[number];
