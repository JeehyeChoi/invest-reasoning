import {
  computeSeriesGrowth,
  type SeriesGrowthConfig,
  type SeriesPoint,
} from "@/backend/services/factors/growth/fundamentals_based/computeSeriesGrowth";
import type { GrowthMetricSignalsExtended } from "@/backend/schemas/factors/growth";

export type OperatingIncomeGrowthConfig = SeriesGrowthConfig;
export type OperatingIncomePoint = SeriesPoint;

export function compute(
  series: OperatingIncomePoint[],
  config: OperatingIncomeGrowthConfig,
): GrowthMetricSignalsExtended | null {
  const mode = config.compute?.mode ?? "basic";

  return computeSeriesGrowth(series, config, mode) as
    | GrowthMetricSignalsExtended
    | null;
}
