// shared/schemas/growth.ts

export type RevenueGrowthMetrics = {
  latestQuarterYoY: number | null;
  previousQuarterYoY: number | null;
  positiveYoYQuarterCount4Q: number | null;
  isYoYGrowthConsistent4Q: boolean | null;
  ttmYoY: number | null;
};
