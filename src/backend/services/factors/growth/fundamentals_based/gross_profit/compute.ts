import {
  computeSeriesGrowth,
  type SeriesGrowthConfig,
  type SeriesPoint,
} from "@/backend/services/factors/growth/fundamentals_based/computeSeriesGrowth";
import type { GrowthMetricSignalsExtended } from "@/backend/schemas/factors/growth";

export type GrossProfitGrowthConfig = SeriesGrowthConfig;
export type GrossProfitPoint = SeriesPoint;

export function compute(
  series: GrossProfitPoint[],
  config: GrossProfitGrowthConfig,
): GrowthMetricSignalsExtended | null {
  const mode = config.compute?.mode ?? "basic";

  return computeSeriesGrowth(series, config, mode) as
    | GrowthMetricSignalsExtended
    | null;
}
